"use client";

import { useState, FormEvent, useEffect, useMemo } from "react";
import type { CorporateDebitAccount, CorporateSession } from "../../../lib/types";

interface CbsSimulatorSectionProps {
  debitAccounts: CorporateDebitAccount[];
  session: CorporateSession | null;
  selectedCorporateId: string;
  onUpdate: () => Promise<void>;
}

export function CbsSimulatorSection({
  debitAccounts,
  session,
  selectedCorporateId,
  onUpdate
}: CbsSimulatorSectionProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"deposit" | "withdraw" | "register" | "ledger">("deposit");
  const [selectedAccount, setSelectedAccount] = useState<CorporateDebitAccount | null>(null);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredAccounts = useMemo(() => {
    return debitAccounts.filter((account) => {
      const matchesSearch =
        !searchQuery ||
        account.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.ifsc.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !statusFilter || account.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [debitAccounts, searchQuery, statusFilter]);

  // Masking & Copy indicators
  const [unmaskedIds, setUnmaskedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form inputs
  const [txnAmount, setTxnAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [initialBalance, setInitialBalance] = useState("10000000.00");

  // Form validation & states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Pre-fill / reset form when drawer opens
  useEffect(() => {
    setTxnAmount("");
    setAccountName("");
    setAccountNumber("");
    setIfsc("");
    setInitialBalance("10000000.00");
    setValidationError(null);
    setBannerNotice(null);
    if (drawerType !== "ledger") {
      setLedgerEntries([]);
      setLedgerError(null);
    }
  }, [isDrawerOpen, drawerType]);

  const toggleMask = (id: string) => {
    setUnmaskedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const validateIfsc = (code: string) => {
    const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return regex.test(code.toUpperCase());
  };

  const fetchLedger = async (acctNum: string) => {
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const response = await fetch(`/v1/cbs/accounts/${acctNum}/ledger`);
      if (!response.ok) {
        throw new Error(`Failed to load ledger (status ${response.status})`);
      }
      const data = await response.json();
      setLedgerEntries(data);
    } catch (err: any) {
      setLedgerError(err.message || "An error occurred fetching ledger history.");
    } finally {
      setLoadingLedger(false);
    }
  };

  const openDepositDrawer = (account: CorporateDebitAccount) => {
    setSelectedAccount(account);
    setDrawerType("deposit");
    setIsDrawerOpen(true);
  };

  const openWithdrawDrawer = (account: CorporateDebitAccount) => {
    setSelectedAccount(account);
    setDrawerType("withdraw");
    setIsDrawerOpen(true);
  };

  const openLedgerDrawer = (account: CorporateDebitAccount) => {
    setSelectedAccount(account);
    setDrawerType("ledger");
    setIsDrawerOpen(true);
    void fetchLedger(account.accountNumber);
  };

  const openRegisterDrawer = () => {
    setSelectedAccount(null);
    setDrawerType("register");
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setBannerNotice(null);

    if (!session || !selectedCorporateId) {
      setValidationError("Session or corporate workspace is not ready.");
      return;
    }

    setFormBusy(true);

    try {
      if (drawerType === "register") {
        const cleanAccountName = accountName.trim();
        const cleanAccountNumber = accountNumber.trim();
        const cleanIfsc = ifsc.trim().toUpperCase();
        const balanceVal = Number(initialBalance);

        if (!cleanAccountName) {
          setValidationError("Account holder name is required.");
          setFormBusy(false);
          return;
        }
        if (!/^\d{9,18}$/.test(cleanAccountNumber)) {
          setValidationError("Account number must be between 9 and 18 digits.");
          setFormBusy(false);
          return;
        }
        if (!validateIfsc(cleanIfsc)) {
          setValidationError("Invalid IFSC format. Example: HDFC0000245.");
          setFormBusy(false);
          return;
        }
        if (isNaN(balanceVal) || balanceVal < 0) {
          setValidationError("Initial balance must be a positive number.");
          setFormBusy(false);
          return;
        }

        const response = await fetch(`/v1/debit-accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            actedByUserId: session.userId,
            bankTenantId: session.bankTenantId,
            corporateTenantId: session.corporateTenantId,
            corporateId: selectedCorporateId,
            accountName: cleanAccountName,
            accountNumber: cleanAccountNumber,
            ifsc: cleanIfsc,
            initialBalance: balanceVal,
            isDefault: false
          })
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok) {
          const traceId = response.headers.get("x-correlation-id") || response.headers.get("x-trace-id");
          const prefix = traceId ? `[Trace: ${traceId}] ` : "";
          setBannerNotice({
            tone: "error",
            text: prefix + (resData.message ?? `Creation failed with status ${response.status}`)
          });
          setFormBusy(false);
          return;
        }

        setBannerNotice({
          tone: "success",
          text: "CBS account created successfully!"
        });
      } else {
        // Deposit or Withdraw
        if (!selectedAccount) {
          setValidationError("No account selected.");
          setFormBusy(false);
          return;
        }

        const amountVal = Number(txnAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
          setValidationError("Please enter a valid amount greater than 0.");
          setFormBusy(false);
          return;
        }

        if (drawerType === "withdraw" && Number(selectedAccount.balance) < amountVal) {
          setValidationError(`Insufficient balance. Current balance is INR ${formatAmount(Number(selectedAccount.balance))}`);
          setFormBusy(false);
          return;
        }

        const url = `/v1/cbs/accounts/${selectedAccount.accountNumber}/${drawerType}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ amount: amountVal })
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok) {
          const traceId = response.headers.get("x-correlation-id") || response.headers.get("x-trace-id");
          const prefix = traceId ? `[Trace: ${traceId}] ` : "";
          setBannerNotice({
            tone: "error",
            text: prefix + (resData.errorMessage ?? resData.message ?? `Transaction failed with status ${response.status}`)
          });
          setFormBusy(false);
          return;
        }

        setBannerNotice({
          tone: "success",
          text: `${drawerType === "deposit" ? "Deposit" : "Withdrawal"} of INR ${formatAmount(amountVal)} processed successfully!`
        });
      }

      // Notify parent to refresh workspace data
      await onUpdate();

      // Close drawer after short delay
      setTimeout(() => {
        setIsDrawerOpen(false);
      }, 1500);

    } catch (err) {
      setBannerNotice({
        tone: "error",
        text: `Network error: ${String(err)}`
      });
    } finally {
      setFormBusy(false);
    }
  };

  function formatAmount(value: number) {
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return (
    <section className="ops-page active" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>CBS Core Banking Simulator</h3>
          <p className="ops-meta" style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
            Simulate deposits, withdrawals, and govern virtual corporate balances to test ledger integrations.
          </p>
        </div>
        <button
          type="button"
          onClick={openRegisterDrawer}
          className="ops-button primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 600
          }}
        >
          Register CBS Account
        </button>
      </div>

      {/* Toolbar / Search filters */}
      <section className="ops-panel" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--surface)", overflow: "hidden", padding: "20px" }}>
        <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ minWidth: "160px", flex: 1 }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label style={{ minWidth: "240px", flex: 1.5 }}>
            Search accounts
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by holder name, account number, IFSC"
            />
          </label>
        </div>

        {/* Custom Stripe/Ramp style layout cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ gridColumn: "1/-1", padding: "40px", textAlign: "center", color: "var(--text-secondary)", border: "1px dashed var(--border)", borderRadius: "12px" }}>
              {debitAccounts.length > 0 ? "No accounts matches search query." : "No corporate CBS accounts found. Register one to begin simulation."}
            </div>
          ) : (
            filteredAccounts.map((account) => {
              const showFull = !!unmaskedIds[account.debitAccountId];
              const displayNum = showFull 
                ? account.accountNumber 
                : `••••••••••••${account.accountNumber.slice(-4)}`;

              return (
                <div
                  key={account.debitAccountId}
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "20px",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}
                >
                  <div>
                    {/* Top Row: Holder & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {account.accountName}
                        </h4>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)" }}>IFSC: {account.ifsc}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(`ifsc-${account.debitAccountId}`, account.ifsc)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "2px",
                              color: copiedId === `ifsc-${account.debitAccountId}` ? "var(--success)" : "var(--text-tertiary)",
                              display: "inline-flex"
                            }}
                          >
                            {copiedId === `ifsc-${account.debitAccountId}` ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: account.status === "active" ? "var(--success-soft)" : "var(--danger-soft)",
                          color: account.status === "active" ? "var(--success)" : "var(--danger)",
                          border: `1px solid ${account.status === "active" ? "var(--success-border)" : "var(--danger-border)"}`
                        }}
                      >
                        {account.status}
                      </span>
                    </div>

                    {/* Middle Row: Masked Number */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                        {displayNum}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleMask(account.debitAccountId)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          color: "var(--text-secondary)",
                          display: "inline-flex"
                        }}
                      >
                        {showFull ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(`num-${account.debitAccountId}`, account.accountNumber)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          color: copiedId === `num-${account.debitAccountId}` ? "var(--success)" : "var(--text-tertiary)",
                          display: "inline-flex"
                        }}
                      >
                        {copiedId === `num-${account.debitAccountId}` ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Balance Display & Action Bar */}
                  <div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                        LEDGER BALANCE
                      </span>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
                        INR {formatAmount(Number(account.balance))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => openDepositDrawer(account)}
                        className="ops-button primary"
                        disabled={account.status !== "active"}
                        style={{ flex: 1, padding: "6px 8px", fontSize: "12px", height: "32px", fontWeight: 600 }}
                      >
                        Deposit
                      </button>
                      <button
                        type="button"
                        onClick={() => openWithdrawDrawer(account)}
                        className="ops-button secondary"
                        disabled={account.status !== "active"}
                        style={{ flex: 1, padding: "6px 8px", fontSize: "12px", height: "32px", fontWeight: 600 }}
                      >
                        Withdraw
                      </button>
                      <button
                        type="button"
                        onClick={() => openLedgerDrawer(account)}
                        className="ops-button secondary"
                        style={{ flex: 1, padding: "6px 8px", fontSize: "12px", height: "32px", fontWeight: 600 }}
                      >
                        Ledger
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={() => !formBusy && setIsDrawerOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(17, 24, 39, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 999
          }}
        />
      )}

      {/* Slide Drawer Panel */}
      {isDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: drawerType === "ledger" ? "540px" : "480px",
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            boxShadow: "-8px 0 32px rgba(17, 24, 39, 0.15)",
            zIndex: 1000,
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto"
          }}
        >
          {/* Drawer Head */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                {drawerType === "register"
                  ? "Register CBS Account"
                  : drawerType === "deposit"
                    ? "Deposit Capital"
                    : drawerType === "withdraw"
                      ? "Withdraw Capital"
                      : "Account Transaction Ledger"}
              </h3>
              <p className="ops-meta" style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
                {drawerType === "register"
                  ? "Initialize a new ledger node with physical or virtual balance."
                  : drawerType === "deposit" || drawerType === "withdraw"
                    ? "Alter virtual balances directly on the simulated CBS core."
                    : `Real-time ledger audit trail for A/C ${selectedAccount?.accountNumber}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !formBusy && setIsDrawerOpen(false)}
              style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-tertiary)" }}
            >
              ✕
            </button>
          </div>

          {/* Form Banner Notice */}
          {bannerNotice && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
                border: `1px solid ${bannerNotice.tone === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
                background: bannerNotice.tone === "success" ? "var(--success-soft)" : "var(--danger-soft)",
                color: bannerNotice.tone === "success" ? "var(--success)" : "var(--danger)"
              }}
            >
              {bannerNotice.text}
            </div>
          )}

          {/* Validation Notice */}
          {validationError && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid var(--danger-border)",
                background: "var(--danger-soft)",
                color: "var(--danger)"
              }}
            >
              ⚠️ {validationError}
            </div>
          )}

          {drawerType === "ledger" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, minHeight: 0 }}>
              {/* Account summary banner */}
              <div style={{ background: "var(--surface-subtle)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedAccount?.accountName}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      A/C: {selectedAccount?.accountNumber} | IFSC: {selectedAccount?.ifsc}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Current Balance</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                      INR {selectedAccount ? formatAmount(Number(selectedAccount.balance)) : "0.00"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0 }}>
                <h4 style={{ margin: "8px 0 4px 0", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Transactions Log ({ledgerEntries.length})
                </h4>

                {loadingLedger ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <div className="spinner" style={{ width: "20px", height: "20px", border: "2px solid var(--border)", borderTopColor: "var(--text-primary)", borderRadius: "50%", borderStyle: "solid" }}></div>
                    <span>Loading ledger...</span>
                  </div>
                ) : ledgerError ? (
                  <div style={{ padding: "20px", color: "var(--danger)", background: "var(--danger-soft)", border: "1px solid var(--danger-border)", borderRadius: "8px", fontSize: "13px" }}>
                    {ledgerError}
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border)", borderRadius: "12px" }}>
                    No transactions found for this account.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", paddingRight: "4px" }}>
                    {ledgerEntries.map((entry) => {
                      const isCredit = entry.transactionType === "credit";
                      const dateStr = new Date(entry.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                      });

                      return (
                        <div
                          key={entry.idempotencyKey || entry.cbsReferenceId}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            fontSize: "13px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                            {/* Direction Indicator Icon */}
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                background: isCredit ? "var(--success-soft)" : "var(--danger-soft)",
                                color: isCredit ? "var(--success)" : "var(--danger)",
                                border: `1px solid ${isCredit ? "var(--success-border)" : "var(--danger-border)"}`
                              }}
                            >
                              {isCredit ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                              )}
                            </div>

                            {/* Narration and Meta */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={entry.narration}>
                                {entry.narration}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "2px", color: "var(--text-tertiary)", fontSize: "11px" }}>
                                <span style={{ fontFamily: "monospace" }}>{entry.cbsReferenceId}</span>
                                <span>•</span>
                                <span>{dateStr}</span>
                              </div>
                            </div>
                          </div>

                          {/* Amount */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: isCredit ? "var(--success)" : "var(--text-primary)"
                              }}
                            >
                              {isCredit ? "+" : "-"} INR {formatAmount(Number(entry.amount))}
                            </div>
                            <span
                              style={{
                                fontSize: "10px",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: "8px",
                                display: "inline-block",
                                marginTop: "2px",
                                background: isCredit ? "var(--success-soft)" : "var(--danger-soft)",
                                color: isCredit ? "var(--success)" : "var(--danger)"
                              }}
                            >
                              {isCredit ? "CR" : "DR"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="ops-button secondary"
                  style={{ width: "100%", padding: "10px", fontWeight: 600 }}
                >
                  Close Ledger
                </button>
              </div>
            </div>
          ) : (
            <form className="ops-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {drawerType === "register" ? (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
                    Account Holder Name
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. Maya Pharma Operating Account"
                      required
                      disabled={formBusy}
                      style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "14px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
                    Account Number
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 401234567890"
                      required
                      disabled={formBusy}
                      style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "14px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
                    IFSC Code
                    <input
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      required
                      disabled={formBusy}
                      maxLength={11}
                      style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "14px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
                    Initial Balance (INR)
                    <input
                      type="number"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="e.g. 10000000.00"
                      required
                      disabled={formBusy}
                      step="0.01"
                      min="0"
                      style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "14px" }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div style={{ background: "var(--surface-subtle)", padding: "14px 18px", borderRadius: "12px", border: "1px solid var(--border)", fontSize: "13px" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Target Node</div>
                    <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{selectedAccount?.accountName}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>A/C: {selectedAccount?.accountNumber}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", marginTop: "12px", paddingTop: "12px", fontWeight: 600 }}>
                      <span>Current balance:</span>
                      <span>INR {formatAmount(Number(selectedAccount?.balance ?? 0))}</span>
                    </div>
                  </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
                    Transaction Amount (INR)
                    <input
                      type="number"
                      value={txnAmount}
                      onChange={(e) => setTxnAmount(e.target.value)}
                      placeholder="e.g. 500000"
                      required
                      disabled={formBusy}
                      step="0.01"
                      min="0.01"
                      autoFocus
                      style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "16px", fontWeight: 600 }}
                    />
                  </label>
                </>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="ops-button secondary"
                  disabled={formBusy}
                  style={{ flex: 1, padding: "12px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ops-button primary"
                  disabled={formBusy}
                  style={{ flex: 1, padding: "12px", fontWeight: 600 }}
                >
                  {formBusy
                    ? "Processing..."
                    : drawerType === "register"
                      ? "Register Node"
                      : drawerType === "deposit"
                        ? "Submit Deposit"
                        : "Submit Withdrawal"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
