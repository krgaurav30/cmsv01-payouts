"use client";

import { useState, FormEvent, useEffect, useMemo } from "react";
import type { CorporateDebitAccount, CorporateSubscription, CorporateSession } from "../../../lib/types";

interface DebitAccountsSectionProps {
  debitAccounts: CorporateDebitAccount[];
  subscriptions: CorporateSubscription[];
  canEdit: boolean;
  session: CorporateSession | null;
  selectedCorporateId: string;
  onUpdate: () => Promise<void>;
  isNested?: boolean;
}

export function DebitAccountsSection({
  debitAccounts,
  subscriptions,
  canEdit,
  session,
  selectedCorporateId,
  onUpdate,
  isNested = false
}: DebitAccountsSectionProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CorporateDebitAccount | null>(null);
  const [actionMenuItem, setActionMenuItem] = useState<CorporateDebitAccount | null>(null);
  
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
  
  // State for unmasked account numbers
  const [unmaskedIds, setUnmaskedIds] = useState<Record<string, boolean>>({});
  // State for copy indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isDefault, setIsDefault] = useState(false);

  // Form validation & status states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Pre-fill form when editing starts
  useEffect(() => {
    if (editingAccount) {
      setAccountName(editingAccount.accountName);
      setAccountNumber(editingAccount.accountNumber);
      setIfsc(editingAccount.ifsc);
      setStatus(editingAccount.status);
      setIsDefault(editingAccount.isDefault);
    } else {
      setAccountName("");
      setAccountNumber("");
      setIfsc("");
      setStatus("active");
      setIsDefault(false);
    }
    setValidationError(null);
    setBannerNotice(null);
  }, [editingAccount, isDrawerOpen]);

  const toggleMask = (id: string) => {
    setUnmaskedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to find subscriptions that have access to a specific debit account
  const getMappedSubscriptions = (accountId: string) => {
    return subscriptions.filter(sub => 
      sub.debitAccounts.some(da => da.debitAccountId === accountId)
    );
  };

  // IFSC validation helper: 11 characters, first 4 letters, 5th '0', next 6 alphanumeric
  const validateIfsc = (code: string) => {
    const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return regex.test(code.toUpperCase());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setBannerNotice(null);

    if (!session || !selectedCorporateId) {
      setValidationError("Session or corporate workspace is not ready.");
      return;
    }

    // Input validations
    const cleanAccountName = accountName.trim();
    const cleanAccountNumber = accountNumber.trim();
    const cleanIfsc = ifsc.trim().toUpperCase();

    if (!cleanAccountName) {
      setValidationError("Account name is required.");
      return;
    }

    if (!/^\d{9,18}$/.test(cleanAccountNumber)) {
      setValidationError("Account number must be between 9 and 18 digits.");
      return;
    }

    if (!validateIfsc(cleanIfsc)) {
      setValidationError("Invalid IFSC format. Example: HDFC0000245 (11 characters, 5th must be zero).");
      return;
    }

    setFormBusy(true);

    try {
      const url = editingAccount 
        ? `/v1/debit-accounts/${editingAccount.debitAccountId}` 
        : `/v1/debit-accounts`;

      const method = editingAccount ? "PUT" : "POST";
      
      const payload = editingAccount 
        ? {
            accountName: cleanAccountName,
            accountNumber: cleanAccountNumber,
            ifsc: cleanIfsc,
            status,
            isDefault
          }
        : {
            bankTenantId: session.bankTenantId,
            corporateTenantId: session.corporateTenantId,
            corporateId: selectedCorporateId,
            accountName: cleanAccountName,
            accountNumber: cleanAccountNumber,
            ifsc: cleanIfsc,
            status,
            isDefault
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBannerNotice({
          tone: "error",
          text: resData.message ?? `Request failed with status ${response.status}`
        });
        setFormBusy(false);
        return;
      }

      setBannerNotice({
        tone: "success",
        text: editingAccount 
          ? "Debit account updated successfully!" 
          : "Debit account created successfully!"
      });

      // Notify parent to refresh list
      await onUpdate();

      // Close drawer after short delay
      setTimeout(() => {
        setIsDrawerOpen(false);
        setEditingAccount(null);
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

  const openCreateDrawer = () => {
    setEditingAccount(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (account: CorporateDebitAccount) => {
    setEditingAccount(account);
    setIsDrawerOpen(true);
  };

  const updateAccountStatus = async (account: CorporateDebitAccount, nextStatus: "active" | "inactive") => {
    setFormBusy(true);
    setValidationError(null);
    setBannerNotice(null);

    try {
      const response = await fetch(`/v1/debit-accounts/${account.debitAccountId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          ifsc: account.ifsc,
          status: nextStatus,
          isDefault: account.isDefault
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBannerNotice({
          tone: "error",
          text: resData.message ?? `Request failed with status ${response.status}`
        });
        return;
      }

      await onUpdate();
      setActionMenuItem(null);
    } catch (err) {
      setBannerNotice({
        tone: "error",
        text: `Network error: ${String(err)}`
      });
    } finally {
      setFormBusy(false);
    }
  };

  return (
    <section className={isNested ? "" : "ops-page active"} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Control Desk Heading & Primary Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Debit Accounts Control Desk</h3>
          <p className="ops-meta" style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
            Configure and govern funding nodes linked to active transaction routers.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateDrawer}
            className="ops-button primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600
            }}
          >
            Add debit account
          </button>
        )}
      </div>

      {/* Main Table Panel */}
      <section className="ops-panel" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--surface)", overflow: "hidden", padding: "20px" }}>
        
        <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ minWidth: "160px", flex: 1 }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label style={{ minWidth: "240px", flex: 1.5 }}>
            Search debit accounts
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by holder name, account number, IFSC"
            />
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="ops-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>ACCOUNT NAME</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>ACCOUNT NUMBER</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>IFSC</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>ACCESS MAP (SUBSCRIPTIONS)</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)", textAlign: "center" }}>DEFAULT</th>
                <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>STATUS</th>
                {canEdit && <th style={{ padding: "16px 20px", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                    {debitAccounts.length > 0 ? "No debit accounts match the current filters." : "No debit accounts found. Add one to start routing payments."}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const mappedSubs = getMappedSubscriptions(account.debitAccountId);
                  const showFull = !!unmaskedIds[account.debitAccountId];
                  const displayNum = showFull 
                    ? account.accountNumber 
                    : `••••••••••••${account.accountNumber.slice(-4)}`;

                  return (
                    <tr
                      key={account.debitAccountId}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background var(--dur-xs) var(--ease)"
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: "16px 20px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {account.accountName}
                      </td>

                      {/* Number with Toggles */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 600 }}>{displayNum}</span>
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
                            title={showFull ? "Mask account number" : "Show account number"}
                          >
                            {showFull ? (
                              // Eye Off SVG
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            ) : (
                              // Eye SVG
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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
                            title="Copy to clipboard"
                          >
                            {copiedId === `num-${account.debitAccountId}` ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* IFSC */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 600 }}>{account.ifsc}</span>
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
                            title="Copy to clipboard"
                          >
                            {copiedId === `ifsc-${account.debitAccountId}` ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Access Map */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {mappedSubs.length === 0 ? (
                            <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontStyle: "italic" }}>
                              No active packages linked
                            </span>
                          ) : (
                            mappedSubs.map(sub => (
                              <span
                                key={sub.subscriptionId}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  background: "var(--accent-soft)",
                                  color: "var(--accent)",
                                  border: "1px solid var(--success-border)",
                                  padding: "2px 8px",
                                  borderRadius: "12px"
                                }}
                              >
                                {sub.packageCode}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Default star badge */}
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        {account.isDefault ? (
                          <span
                            style={{
                              color: "#f59e0b",
                              fontSize: "18px",
                              display: "inline-flex",
                              justifyContent: "center",
                              alignItems: "center"
                            }}
                            title="Default Account"
                          >
                            ★
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px 20px" }}>
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
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setActionMenuItem(account)}
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              cursor: "pointer",
                              fontSize: "18px",
                              lineHeight: 1
                            }}
                            title="More actions"
                          >
                            ⋮
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {actionMenuItem && (
        <div
          onClick={() => setActionMenuItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1090,
            background: "rgba(15, 23, 42, 0.26)",
            backdropFilter: "blur(2px)"
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "360px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
              padding: "20px",
              zIndex: 1100
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Debit account actions</h3>
                <p className="ops-meta" style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>
                  {actionMenuItem.accountName} · {actionMenuItem.accountNumber.slice(-4)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionMenuItem(null)}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  openEditDrawer(actionMenuItem);
                  setActionMenuItem(null);
                }}
                className="ops-button secondary"
                style={{ width: "100%", justifyContent: "flex-start" }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => updateAccountStatus(actionMenuItem, actionMenuItem.status === "active" ? "inactive" : "active")}
                className="ops-button secondary"
                style={{ width: "100%", justifyContent: "flex-start" }}
                disabled={formBusy}
              >
                {actionMenuItem.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for Slide Drawer */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(17, 24, 39, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            transition: "opacity var(--dur-md) var(--ease)"
          }}
        />
      )}

      {/* High-Fidelity Sliding Drawer Form */}
      {isDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "480px",
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
                {editingAccount ? "Modify Debit Account" : "Register Funding Node"}
              </h3>
              <p className="ops-meta" style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
                {editingAccount 
                  ? "Adjust settings and validation params for this active node." 
                  : "Onboard a new debit account with active IFSC routing."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "var(--text-tertiary)"
              }}
            >
              ✕
            </button>
          </div>

          {/* Form Banner Notifications */}
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

          {/* Validation Alert */}
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

          {/* Main Form */}
          <form className="ops-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
              Account Holder Name
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Future Pay Treasury A/C"
                required
                disabled={formBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  fontSize: "14px"
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
              Account Number
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 50200049281729"
                required
                disabled={formBusy}
                type="text"
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  fontFamily: "monospace",
                  fontSize: "14px"
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
              IFSC Code
              <input
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0000245"
                required
                disabled={formBusy}
                maxLength={11}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  fontFamily: "monospace",
                  fontSize: "14px"
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 500 }}>
              Account Routing Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                disabled={formBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  fontSize: "14px",
                  background: "var(--surface)"
                }}
              >
                <option value="active">Active (Available for routing)</option>
                <option value="inactive">Inactive (Disabled)</option>
              </select>
            </label>

            {/* Default Account Toggle with Banner Alert */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              <label className="ops-toggle" style={{ display: "inline-flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isDefault}
                  disabled={formBusy}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    width: "44px",
                    height: "22px",
                    borderRadius: "11px",
                    background: isDefault ? "var(--accent)" : "var(--border)",
                    position: "relative",
                    transition: "background var(--dur-sm) var(--ease)"
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      position: "absolute",
                      left: isDefault ? "24px" : "4px",
                      transition: "left var(--dur-sm) var(--ease)"
                    }}
                  />
                </span>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Set as Default Account</span>
              </label>

              {isDefault && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "var(--warning-soft)",
                    color: "var(--warning)",
                    border: "1px solid var(--warning-border)"
                  }}
                >
                  ⚠️ <strong>Notice:</strong> Marking this account as default will automatically replace any existing default funding account.
                </div>
              )}
            </div>

            {/* Footer Buttons */}
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
                {formBusy ? "Saving node..." : editingAccount ? "Save updates" : "Register Node"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

