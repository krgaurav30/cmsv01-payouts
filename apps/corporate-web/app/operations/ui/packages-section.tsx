"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CorporateDebitAccount } from "../../../lib/types";

type PaymentMethod = {
  paymentMethodCode: string;
  displayName: string;
  status: "active" | "inactive";
};

type PackageItem = {
  packageId: string;
  packageCode: string;
  name: string;
  useCase: "vendor_payments" | "salary" | "statutory";
  description: string | null;
  allowedBeneficiaryTypes: string[];
  debitModesAllowed: string[];
  fileRejectionModesAllowed: string[];
  paymentMethods: Array<{ paymentMethodCode: string }>;
  defaultPaymentMethodCode: string | null;
  debitAccountIds: string[];
  defaultDebitAccountId: string | null;
  maxPaymentsPerBatch: number;
};

interface PackagesSectionProps {
  corporateTenantId: string;
  corporateId: string;
  bankTenantId: string;
  debitAccounts: CorporateDebitAccount[];
}

function MultiDropdown({
  label,
  options,
  values,
  onChange
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabels = values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);

  const filteredOptions = options.filter((option) => {
    const haystack = `${option.label} ${option.value}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      const target = event.target as HTMLElement;
      if (!target.closest(`[data-multi-dropdown="${label}"]`)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [label]);

  return (
    <div data-multi-dropdown={label} style={{ position: "relative" }}>
      <button
        type="button"
        className="ops-input"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          minHeight: "44px",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          whiteSpace: "normal"
        }}
      >
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            alignItems: "center"
          }}
        >
          {selectedLabels.length > 0 ? (
            selectedLabels.slice(0, 3).map((item) => (
              <span
                key={item}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  fontSize: "12px",
                  fontWeight: 600
                }}
              >
                {item}
              </span>
            ))
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>{`Select ${label}`}</span>
          )}
          {selectedLabels.length > 3 ? (
            <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              +{selectedLabels.length - 3} more
            </span>
          ) : null}
        </span>
        <span style={{ color: "var(--text-secondary)", flex: "0 0 auto" }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-lg)",
            padding: "10px",
            maxHeight: "220px",
            overflow: "auto"
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label}`}
            style={{
              width: "100%",
              marginBottom: "10px",
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--surface)"
            }}
          />
          {filteredOptions.length > 0 ? filteredOptions.map((option) => {
            const checked = values.includes(option.value);
            return (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "999px",
                      border: `1px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
                      background: checked ? "var(--accent)" : "transparent",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span>{option.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      checked ? values.filter((value) => value !== option.value) : [...values, option.value]
                    )
                  }
                  style={{
                    border: "0",
                    background: "transparent",
                    color: checked ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {checked ? "Selected" : "Add"}
                </button>
              </label>
            );
          }) : (
            <div style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "13px" }}>
              No matches
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PackagesSection({
  corporateTenantId,
  corporateId,
  bankTenantId,
  debitAccounts
}: PackagesSectionProps) {
  const [items, setItems] = useState<PackageItem[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [actionMenuItem, setActionMenuItem] = useState<PackageItem | null>(null);

  const [packageCode, setPackageCode] = useState("");
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState<"vendor_payments" | "salary" | "statutory">(
    "vendor_payments"
  );
  const [description, setDescription] = useState("");
  const [allowedBeneficiaryTypes, setAllowedBeneficiaryTypes] = useState<string[]>(["vendor"]);
  const [debitModeAllowed, setDebitModeAllowed] = useState("single");
  const [fileRejectionMode, setFileRejectionMode] = useState("fail_full_file");
  const [paymentMethodCodes, setPaymentMethodCodes] = useState<string[]>([]);
  const [defaultPaymentMethodCode, setDefaultPaymentMethodCode] = useState("");
  const [debitAccountIds, setDebitAccountIds] = useState<string[]>([]);
  const [defaultDebitAccountId, setDefaultDebitAccountId] = useState("");
  const [maxPaymentsPerBatch, setMaxPaymentsPerBatch] = useState(1000);
  const [bulkApproveEnabled, setBulkApproveEnabled] = useState(false);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures on unsupported browsers.
    }
  }

  async function load() {
    const [packagesResp, methodsResp] = await Promise.all([
      fetch(
        `/v1/package-catalog/packages?ownerType=corporate&corporateTenantId=${encodeURIComponent(
          corporateTenantId
        )}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetch("/v1/package-catalog/payment-methods?status=active")
    ]);
    const packagesData = await packagesResp.json().catch(() => ({ items: [] }));
    const methodsData = await methodsResp.json().catch(() => ({ items: [] }));
    setItems(packagesData.items ?? []);
    setMethods(methodsData.items ?? []);
  }

  useEffect(() => {
    void load();
  }, [corporateTenantId, corporateId]);

  const allowedPaymentMethodOptions = useMemo(
    () =>
      methods.map((method) => ({
        value: method.paymentMethodCode,
        label: `${method.displayName} (${method.paymentMethodCode})`
      })),
    [methods]
  );

  const allowedDebitAccountOptions = useMemo(
    () =>
      debitAccounts.map((account) => ({
        value: account.debitAccountId,
        label: `${account.accountName} (${account.accountNumber})`
      })),
    [debitAccounts]
  );

  const defaultMethodOptions = useMemo(
    () =>
      methods
        .filter((method) => paymentMethodCodes.includes(method.paymentMethodCode))
        .map((method) => ({
          value: method.paymentMethodCode,
          label: `${method.displayName} (${method.paymentMethodCode})`
        })),
    [methods, paymentMethodCodes]
  );

  const defaultDebitOptions = useMemo(
    () =>
      debitAccounts
        .filter((account) => debitAccountIds.includes(account.debitAccountId))
        .map((account) => ({
          value: account.debitAccountId,
          label: `${account.accountName} (${account.accountNumber})`
        })),
    [debitAccounts, debitAccountIds]
  );

  function resetForm() {
    setEditing(null);
    setPackageCode("");
    setName("");
    setUseCase("vendor_payments");
    setDescription("");
    setAllowedBeneficiaryTypes(["vendor"]);
    setDebitModeAllowed("single");
    setFileRejectionMode("fail_full_file");
    setPaymentMethodCodes([]);
    setDefaultPaymentMethodCode("");
    setDebitAccountIds([]);
    setDefaultDebitAccountId("");
    setMaxPaymentsPerBatch(1000);
    setBulkApproveEnabled(false);
    setMsg("");
  }

  function cancelEditing() {
    resetForm();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg("");

    if (!paymentMethodCodes.includes(defaultPaymentMethodCode)) {
      setMsg("Default payment method must be one of the allowed payment methods.");
      return;
    }

    if (defaultDebitAccountId && !debitAccountIds.includes(defaultDebitAccountId)) {
      setMsg("Default debit account must be one of the allowed debit accounts.");
      return;
    }

    const payload = {
      bankTenantId,
      corporateTenantId,
      corporateId,
      packageCode: packageCode.trim().toUpperCase(),
      displayName: name.trim(),
      description: description.trim() || null,
      useCase,
      allowedBeneficiaryTypes,
      bulkApproveEnabled: false,
      debitModesAllowed: [debitModeAllowed],
      fileRejectionModesAllowed: [fileRejectionMode],
      maxPaymentsPerBatch,
      pricingDefaults: { platformFee: "0" },
      paymentMethodCodes,
      defaultPaymentMethodCode,
      debitAccountIds,
      defaultDebitAccountId: defaultDebitAccountId || null,
      status: "active"
    };

    const response = await fetch(
      editing
        ? `/v1/package-catalog/packages/by-id/${encodeURIComponent(editing.packageId)}`
        : "/v1/package-catalog/packages",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMsg(data.message ?? "Failed to save package.");
      return;
    }

    setMsg(editing ? "Package updated successfully." : "Package created successfully.");
    setToast(editing ? "Package updated successfully." : "Package created successfully.");
    resetForm();
    await load();
  }

  function beginEdit(item: PackageItem) {
    setActionMenuItem(null);
    setEditing(item);
    setPackageCode(item.packageCode);
    setName(item.name);
    setUseCase(item.useCase);
    setDescription(item.description ?? "");
    setAllowedBeneficiaryTypes(item.allowedBeneficiaryTypes);
    setDebitModeAllowed(item.debitModesAllowed[0] ?? "single");
    setFileRejectionMode(item.fileRejectionModesAllowed[0] ?? "fail_full_file");
    setPaymentMethodCodes(item.paymentMethods.map((method) => method.paymentMethodCode));
    setDefaultPaymentMethodCode(item.defaultPaymentMethodCode ?? "");
    setDebitAccountIds(item.debitAccountIds ?? []);
    setDefaultDebitAccountId(item.defaultDebitAccountId ?? "");
    setMaxPaymentsPerBatch(item.maxPaymentsPerBatch);
    setBulkApproveEnabled(false);
  }

  async function updatePackageStatus(item: PackageItem, nextStatus: "active" | "inactive") {
    setActionMenuItem(null);
    const response = await fetch(`/v1/package-catalog/packages/by-id/${encodeURIComponent(item.packageId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankTenantId,
        corporateTenantId,
        corporateId,
        packageCode: item.packageCode,
        displayName: item.name,
        description: item.description,
        useCase: item.useCase,
        allowedBeneficiaryTypes: item.allowedBeneficiaryTypes,
        bulkApproveEnabled: false,
        debitModesAllowed: item.debitModesAllowed,
        fileRejectionModesAllowed: item.fileRejectionModesAllowed,
        maxPaymentsPerBatch: item.maxPaymentsPerBatch,
        pricingDefaults: { platformFee: "0" },
        paymentMethodCodes: item.paymentMethods.map((method) => method.paymentMethodCode),
        defaultPaymentMethodCode: item.defaultPaymentMethodCode,
        debitAccountIds: item.debitAccountIds,
        defaultDebitAccountId: item.defaultDebitAccountId,
        status: nextStatus
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.message ?? "Unable to update package status.");
      return;
    }
    setToast(`Package ${nextStatus === "active" ? "activated" : "deactivated"} successfully.`);
    await load();
  }

  return (
    <section className="ops-page active" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {toast ? (
        <div
          style={{
            position: "sticky",
            top: "12px",
            zIndex: 30,
            background: "var(--success-soft)",
            color: "var(--success)",
            border: "1px solid var(--success-border)",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "var(--shadow-md)"
          }}
        >
          <span>{toast}</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {toast.toLowerCase().includes("error") || toast.toLowerCase().includes("failed") ? (
              <button
                type="button"
                className="ops-mini"
                onClick={() => void copyText(toast)}
              >
                Copy
              </button>
            ) : null}
            <button type="button" className="ops-mini" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {actionMenuItem ? (
        <div
          onMouseDown={() => setActionMenuItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(15, 23, 42, 0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "320px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              padding: "18px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
              <div>
                <h4 style={{ margin: 0 }}>Package Actions</h4>
                <p className="ops-meta" style={{ margin: "4px 0 0 0" }}>
                  {actionMenuItem.packageCode} · {actionMenuItem.name}
                </p>
              </div>
              <button type="button" className="ops-mini" onClick={() => setActionMenuItem(null)}>
                Close
              </button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <button
                type="button"
                className="ops-mini"
                style={{ width: "100%", textAlign: "left", padding: "12px 14px" }}
                onClick={() => beginEdit(actionMenuItem)}
              >
                Edit
              </button>
              <button
                type="button"
                className="ops-mini"
                style={{ width: "100%", textAlign: "left", padding: "12px 14px" }}
                onClick={() => void updatePackageStatus(actionMenuItem, "active")}
              >
                Activate
              </button>
              <button
                type="button"
                className="ops-mini"
                style={{ width: "100%", textAlign: "left", padding: "12px 14px" }}
                onClick={() => void updatePackageStatus(actionMenuItem, "inactive")}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="ops-panel" style={{ padding: "24px" }}>
        <div className="ops-panel-head" style={{ marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0 }}>Create / Edit Package</h3>
            <p className="ops-meta" style={{ margin: "4px 0 0 0" }}>
              Matches the package architecture schema with dropdown-based multi-selects.
            </p>
          </div>
        </div>

        <form className="ops-form" onSubmit={submit}>
          <div className="ops-fields two">
            <label>
              Package Code
              <input value={packageCode} onChange={(e) => setPackageCode(e.target.value)} required />
            </label>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          </div>

          <div className="ops-fields three">
            <label>
              Use Case
              <select value={useCase} onChange={(e) => setUseCase(e.target.value as "vendor_payments" | "salary" | "statutory")}>
                <option value="vendor_payments">vendor_payments</option>
                <option value="salary">salary</option>
                <option value="statutory">statutory</option>
              </select>
            </label>
            <label>
              Max Payments Per Batch
              <input type="number" min={1} value={maxPaymentsPerBatch} onChange={(e) => setMaxPaymentsPerBatch(Number(e.target.value))} />
            </label>
            <label>
              Status
              <input value="active" disabled />
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Allowed Beneficiary Types
              <MultiDropdown
                label="beneficiary types"
                options={[
                  { value: "vendor", label: "Vendor" },
                  { value: "employee", label: "Employee" },
                  { value: "statutory", label: "Statutory" }
                ]}
                values={allowedBeneficiaryTypes}
                onChange={setAllowedBeneficiaryTypes}
              />
            </label>
            <label>
              Allowed Payment Methods
              <MultiDropdown
                label="payment methods"
                options={allowedPaymentMethodOptions}
                values={paymentMethodCodes}
                onChange={setPaymentMethodCodes}
              />
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Default Payment Method
              <select value={defaultPaymentMethodCode} onChange={(e) => setDefaultPaymentMethodCode(e.target.value)} required>
                <option value="">Select</option>
                {defaultMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Allowed Debit Accounts
              <MultiDropdown
                label="debit accounts"
                options={allowedDebitAccountOptions}
                values={debitAccountIds}
                onChange={setDebitAccountIds}
              />
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Default Debit Account
              <select value={defaultDebitAccountId} onChange={(e) => setDefaultDebitAccountId(e.target.value)}>
                <option value="">None</option>
                {defaultDebitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Allowed Debit Mode
              <select value={debitModeAllowed} onChange={(e) => setDebitModeAllowed(e.target.value)}>
                <option value="single">Single</option>
                <option value="multi">Multi</option>
              </select>
            </label>
          </div>

          <div className="ops-fields two">
            <label>
              Allowed File Failure Handling
              <select value={fileRejectionMode} onChange={(e) => setFileRejectionMode(e.target.value)}>
                <option value="fail_full_file">Fail Full File</option>
                <option value="reject_invalid_rows">Reject Invalid Rows</option>
              </select>
            </label>
            <label>
              Bulk Approval
              <label className="ops-toggle">
                <input
                  checked={bulkApproveEnabled}
                  onChange={(e) => setBulkApproveEnabled(e.target.checked)}
                  type="checkbox"
                />
                <span className="ops-toggle-track">
                  <span className="ops-toggle-thumb" />
                </span>
                <span className="ops-toggle-label">{bulkApproveEnabled ? "Enabled" : "Disabled"}</span>
              </label>
            </label>
          </div>

          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          {msg ? <p className="ops-meta">{msg}</p> : null}
          <div className="ops-actions">
            <button className="ops-button primary" type="submit">
              {editing ? "Save package" : "Create package"}
            </button>
            {editing ? (
              <button className="ops-button" type="button" onClick={cancelEditing}>
                Cancel
              </button>
            ) : (
              <button className="ops-button" type="button" onClick={resetForm}>
                Reset
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="ops-panel" style={{ padding: "24px" }}>
        <div className="ops-panel-head" style={{ marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0 }}>Packages</h3>
            <p className="ops-meta" style={{ margin: "4px 0 0 0" }}>
              Edit existing packages from the same schema-driven form.
            </p>
          </div>
        </div>
        <div className="ops-table-shell">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Use Case</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.packageId}>
                    <td>{item.packageCode}</td>
                    <td>{item.name}</td>
                    <td>{item.useCase}</td>
                    <td>
                      <div style={{ display: "inline-flex" }}>
                        <button
                          className="ops-kebab"
                          type="button"
                          onClick={() => setActionMenuItem((current) => (current?.packageId === item.packageId ? null : item))}
                        >
                          ⋮
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="ops-empty-row" colSpan={4}>
                    No packages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
