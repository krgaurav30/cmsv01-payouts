"use client";

import { useEffect, useState, use } from "react";

type CheckoutSession = {
  checkoutSessionId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  transactionReference: string;
  amountValue: string;
  amountCurrency: string;
  packageCode: string | null;
  beneficiaryId: string;
  paymentMethodCode: string | null;
  redirectUrl: string | null;
  cancelUrl: string | null;
  status: "open" | "completed" | "expired";
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
};

export default function CheckoutPage({ params: paramsPromise }: { params: Promise<{ sessionId: string }> }) {
  const params = use(paramsPromise);
  const sessionId = params.sessionId;
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection options
  const [packages, setPackages] = useState<any[]>([]);
  const [debitAccounts, setDebitAccounts] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);

  // Form states
  const [selectedPackageCode, setSelectedPackageCode] = useState("");
  const [selectedDebitAccountId, setSelectedDebitAccountId] = useState("");
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState("");
  const [makerUsername, setMakerUsername] = useState("grvmaker");
  const [remark, setRemark] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [commandDetails, setCommandDetails] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [sessionRes, optionsRes] = await Promise.all([
          fetch(`/v1/checkout/sessions/${sessionId}`),
          fetch(`/v1/checkout/sessions/${sessionId}/options`)
        ]);

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load checkout session");
        }
        const sessionData = await sessionRes.json();
        setSession(sessionData);

        if (optionsRes.ok) {
          const optionsData = await optionsRes.json();
          setPackages(optionsData.packages || []);
          setDebitAccounts(optionsData.debitAccounts || []);
          setBeneficiaries(optionsData.beneficiaries || []);

          // Pre-populate if already specified in session (backward-compatibility/default payload helper)
          if (sessionData.packageCode) {
            setSelectedPackageCode(sessionData.packageCode);
          }
          if (sessionData.beneficiaryId) {
            setSelectedBeneficiaryId(sessionData.beneficiaryId);
          }
          if (sessionData.paymentMethodCode) {
            setSelectedPaymentMethodCode(sessionData.paymentMethodCode);
          }
        }
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [sessionId]);

  // Derived filtered selection states
  const chosenPackage = packages.find(p => p.packageCode === selectedPackageCode);
  
  const filteredDebitAccounts = debitAccounts.filter(
    a => a.packageCode === selectedPackageCode
  );

  const filteredBeneficiaries = beneficiaries.filter(b => {
    if (!chosenPackage) return false;
    return chosenPackage.allowedBeneficiaryTypes.includes(b.type);
  });

  const chosenDebitAccount = debitAccounts.find(
    a => a.debitAccountId === selectedDebitAccountId && a.packageCode === selectedPackageCode
  );

  const filteredPaymentMethods = chosenDebitAccount ? chosenDebitAccount.allowedPaymentMethods : [];

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !makerUsername.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/v1/checkout/sessions/${sessionId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          actorUsername: makerUsername.trim(),
          packageCode: selectedPackageCode || undefined,
          debitAccountId: selectedDebitAccountId || undefined,
          beneficiaryId: selectedBeneficiaryId || undefined,
          paymentMethodCode: selectedPaymentMethodCode || undefined,
          remark: remark.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment authorization failed");
      }

      setPaymentSuccess(true);
      setCommandDetails(data);

      // Notify parent app (iframe container) via postMessage
      if (window.parent) {
        window.parent.postMessage(
          {
            type: "PAYMENT_SUCCESS",
            payload: {
              sessionId,
              commandId: data.commandId,
              status: data.status,
              packageCode: data.packageCode,
              reference: session.transactionReference
            }
          },
          "*"
        );
      }

      // Auto-redirect if redirectUrl is configured
      if (session.redirectUrl) {
        setTimeout(() => {
          window.location.href = session.redirectUrl!;
        }, 2500);
      }
    } catch (err: any) {
      setError(err.message || String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.parent) {
      window.parent.postMessage({ type: "PAYMENT_CANCELLED", payload: { sessionId } }, "*");
    }
    if (session?.cancelUrl) {
      window.location.href = session.cancelUrl;
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinnerContainer}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: "12px", color: "#64748B", fontSize: "14px" }}>Securing checkout session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorHeader}>✕</div>
          <h2 style={styles.errorTitle}>Invalid Checkout Session</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button onClick={handleCancel} style={styles.secondaryButton}>
            Return to merchant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>FuturePay</div>
          <span style={styles.statusBadge(session?.status || "open")}>
            {session?.status === "open" ? "Secure Checkout" : session?.status}
          </span>
        </div>

        {paymentSuccess ? (
          <div style={styles.successContainer}>
            <div style={styles.successBadge}>✓</div>
            <h2 style={styles.successTitle}>Payment Initiated</h2>
            <p style={styles.successText}>
              The transaction has been successfully created and queued for checker approval.
            </p>
            <div style={styles.receipt}>
              <div style={styles.receiptRow}>
                <span>Reference</span>
                <strong style={styles.receiptValue}>{session?.transactionReference}</strong>
              </div>
              <div style={styles.receiptRow}>
                <span>Command ID</span>
                <strong style={styles.receiptValue}>{commandDetails?.commandId}</strong>
              </div>
              <div style={styles.receiptRow}>
                <span>Amount Paid</span>
                <strong style={styles.receiptValue}>
                  {session?.amountCurrency} {Number(session?.amountValue).toLocaleString()}
                </strong>
              </div>
            </div>
            {session?.redirectUrl ? (
              <p style={styles.redirectText}>Redirecting you back to merchant...</p>
            ) : (
              <button onClick={handleCancel} style={styles.primaryButton}>
                Continue
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Amount Summary */}
            <div style={styles.amountBox}>
              <span style={styles.amountLabel}>PAYMENT AMOUNT</span>
              <div style={styles.amount}>
                {session?.amountCurrency} {Number(session?.amountValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={styles.merchantInfo}>
                To: <span style={{ fontWeight: 600, color: "#1E293B" }}>{session?.corporateId}</span>
              </div>
            </div>

            {/* Error banner */}
            {error && <div style={styles.errorBanner}>{error}</div>}

            {/* Payment Form */}
            <form onSubmit={handlePay} style={styles.form}>
              {/* 1. Select Package */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Workspace Package</label>
                <select
                  required
                  disabled={submitting || session?.status !== "open"}
                  value={selectedPackageCode}
                  onChange={(e) => {
                    setSelectedPackageCode(e.target.value);
                    setSelectedDebitAccountId("");
                    setSelectedBeneficiaryId("");
                    setSelectedPaymentMethodCode("");
                  }}
                  style={styles.select}
                >
                  <option value="">-- Choose Package --</option>
                  {packages.map((p) => (
                    <option key={p.packageCode} value={p.packageCode}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Select Debit Account */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Debit Account (Allowed in Package)</label>
                <select
                  required
                  disabled={submitting || session?.status !== "open" || !selectedPackageCode}
                  value={selectedDebitAccountId}
                  onChange={(e) => {
                    setSelectedDebitAccountId(e.target.value);
                    setSelectedPaymentMethodCode("");
                  }}
                  style={styles.select}
                >
                  <option value="">-- Choose Debit Account --</option>
                  {filteredDebitAccounts.map((a) => (
                    <option key={a.debitAccountId} value={a.debitAccountId}>
                      {a.accountName} ({a.accountNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Beneficiary */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Beneficiary (Allowed in Package)</label>
                {session?.beneficiaryId ? (
                  <input
                    type="text"
                    disabled
                    value={
                      (() => {
                        const b = beneficiaries.find((x) => x.beneficiaryId === session.beneficiaryId);
                        return b ? `${b.name} (${b.beneficiaryId})` : session.beneficiaryId;
                      })()
                    }
                    style={styles.disabledInput}
                  />
                ) : (
                  <select
                    required
                    disabled={submitting || session?.status !== "open" || !selectedPackageCode}
                    value={selectedBeneficiaryId}
                    onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">-- Choose Beneficiary --</option>
                    {filteredBeneficiaries.map((b) => (
                      <option key={b.beneficiaryId} value={b.beneficiaryId}>
                        {b.name} ({b.accountNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 4. Select Payment Method */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Payment Method</label>
                <select
                  required
                  disabled={submitting || session?.status !== "open" || !selectedDebitAccountId}
                  value={selectedPaymentMethodCode}
                  onChange={(e) => setSelectedPaymentMethodCode(e.target.value)}
                  style={styles.select}
                >
                  <option value="">-- Choose Payment Method --</option>
                  {filteredPaymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Transaction Remark */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Transaction Remark (Optional)</label>
                <input
                  type="text"
                  disabled={submitting || session?.status !== "open"}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. Invoice #2049 payout"
                  style={styles.input}
                />
                <span style={styles.helpText}>
                  Provide a short reference note/narration for this transaction.
                </span>
              </div>

              {/* 6. Maker Username */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Authorize Maker Username</label>
                <input
                  type="text"
                  required
                  disabled={true}
                  value={makerUsername}
                  onChange={(e) => setMakerUsername(e.target.value)}
                  placeholder="e.g. grvmaker"
                  style={styles.disabledInput}
                />
                <span style={styles.helpText}>
                  Maker account is pre-authenticated from the parent corporate environment.
                </span>
              </div>

              {/* Transaction details */}
              <div style={styles.detailsGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Reference</span>
                  <span style={styles.detailValue}>{session?.transactionReference}</span>
                </div>
              </div>

              {/* Actions */}
              {session?.status === "open" ? (
                <div style={styles.actionRow}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={styles.payButton}
                  >
                    {submitting ? "Processing..." : `Pay ${session?.amountCurrency} ${Number(session?.amountValue).toLocaleString()}`}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <p style={{ color: "#EF4444", fontWeight: 500, fontSize: "14px" }}>
                    This session is {session?.status} and cannot be processed.
                  </p>
                  <button type="button" onClick={handleCancel} style={styles.secondaryButton}>
                    Return
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: "20px",
    fontFamily: "Inter, -apple-system, sans-serif"
  },
  card: {
    background: "#FFFFFF",
    borderRadius: "16px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)",
    border: "1px solid #E2E8F0",
    width: "100%",
    maxWidth: "480px",
    padding: "32px",
    boxSizing: "border-box" as const
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "24px"
  },
  logo: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.025em"
  },
  statusBadge: (status: string) => ({
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: "4px 8px",
    borderRadius: "20px",
    background: status === "open" ? "#E0F2FE" : "#FEE2E2",
    color: status === "open" ? "#0369A1" : "#B91C1C"
  }),
  amountBox: {
    background: "#F8FAFC",
    border: "1px solid #F1F5F9",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center" as const,
    marginBottom: "24px"
  },
  amountLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#94A3B8",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "4px"
  },
  amount: {
    fontSize: "32px",
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.03em"
  },
  merchantInfo: {
    fontSize: "12px",
    color: "#64748B",
    marginTop: "6px"
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px"
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569"
  },
  input: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    height: "44px",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s ease",
    color: "#0F172A"
  },
  disabledInput: {
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    height: "44px",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#F1F5F9",
    color: "#64748B",
    cursor: "not-allowed"
  },
  select: {
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    height: "44px",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#FFFFFF",
    color: "#0F172A",
    cursor: "pointer"
  },
  helpText: {
    fontSize: "11px",
    color: "#94A3B8",
    lineHeight: "1.4"
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    background: "#F8FAFC",
    padding: "16px",
    borderRadius: "10px",
    border: "1px solid #F1F5F9"
  },
  detailItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px"
  },
  detailLabel: {
    fontSize: "9px",
    fontWeight: 600,
    color: "#94A3B8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em"
  },
  detailValue: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155"
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "8px"
  },
  cancelButton: {
    flex: 1,
    height: "44px",
    borderRadius: "8px",
    background: "transparent",
    border: "1px solid #E2E8F0",
    color: "#64748B",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s"
  },
  payButton: {
    flex: 2,
    height: "44px",
    borderRadius: "8px",
    background: "#10B981",
    border: "none",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)"
  },
  primaryButton: {
    width: "100%",
    height: "44px",
    borderRadius: "8px",
    background: "#10B981",
    border: "none",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer"
  },
  secondaryButton: {
    width: "100%",
    height: "44px",
    borderRadius: "8px",
    background: "#F1F5F9",
    border: "none",
    color: "#475569",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "16px"
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 0"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #E2E8F0",
    borderTop: "3px solid #10B981",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite"
  },
  errorBanner: {
    background: "#FEF2F2",
    border: "1px solid #FEE2E2",
    borderRadius: "8px",
    color: "#B91C1C",
    padding: "12px 14px",
    fontSize: "13px",
    lineHeight: "1.4",
    marginBottom: "20px"
  },
  errorHeader: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "#FEE2E2",
    color: "#EF4444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    margin: "0 auto 20px auto"
  },
  errorTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#0F172A",
    textAlign: "center" as const,
    margin: "0 0 8px 0"
  },
  errorMessage: {
    fontSize: "14px",
    color: "#64748B",
    textAlign: "center" as const,
    lineHeight: "1.5",
    margin: "0 0 24px 0"
  },
  successContainer: {
    textAlign: "center" as const,
    padding: "10px 0"
  },
  successBadge: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "#D1FAE5",
    color: "#10B981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    margin: "0 auto 20px auto"
  },
  successTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#0F172A",
    margin: "0 0 8px 0"
  },
  successText: {
    fontSize: "14px",
    color: "#64748B",
    lineHeight: "1.5",
    margin: "0 0 24px 0"
  },
  receipt: {
    background: "#F8FAFC",
    border: "1px solid #F1F5F9",
    borderRadius: "12px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    marginBottom: "24px"
  },
  receiptRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#64748B"
  },
  receiptValue: {
    color: "#334155",
    fontWeight: 600
  },
  redirectText: {
    fontSize: "12px",
    color: "#94A3B8",
    fontStyle: "italic" as const,
    marginTop: "16px"
  }
};
