"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type BankTenant = {
  tenantId: string;
  name: string;
};

type PaymentMethod = {
  paymentMethodCode: string;
  displayName: string;
  minAmount: number | null;
  maxAmount: number | null;
  cutoffTime: string;
  status: "active" | "inactive";
};

type PackageEntry = {
  packageId: string;
  ownerType: "bank" | "corporate";
  bankTenantId: string;
  corporateTenantId: string | null;
  corporateId: string | null;
  packageCode: string;
  basePackageCode: string | null;
  name: string;
  useCase: string;
  description: string | null;
  allowedBeneficiaryTypes: string[];
  bulkApproveEnabled: boolean;
  debitModesAllowed: string[];
  defaultDebitMode: string;
  fileRejectionModesAllowed: string[];
  defaultFileRejectionMode: string;
  defaultPaymentMethodCode: string | null;
  maxPaymentsPerBatch: number;
  pricingDefaults: Record<string, unknown>;
  status: "active" | "inactive";
  paymentMethods: Array<{ paymentMethodCode: string }>;
};

const PACKAGE_USE_CASE_OPTIONS = [
  { value: "vendor_payments", label: "Vendor payments" },
  { value: "salary", label: "Salary" },
  { value: "statutory", label: "Statutory" }
] as const;

const BENEFICIARY_TYPE_OPTIONS = [
  { value: "vendor", label: "Vendor" },
  { value: "employee", label: "Employee" },
  { value: "statutory", label: "Statutory" }
] as const;

const DEBIT_MODE_OPTIONS = [
  { value: "single", label: "Single debit" },
  { value: "multi", label: "Multi debit" }
] as const;

const FILE_REJECTION_MODE_OPTIONS = [
  { value: "fail_full_file", label: "Fail full file" },
  { value: "reject_invalid_rows", label: "Reject invalid rows" }
] as const;

function createDefaultPackageForm() {
  return {
    useCase: "vendor_payments",
    allowedBeneficiaryTypes: ["vendor"],
    paymentMethodCodes: ["NEFT"],
    defaultPaymentMethodCode: "NEFT",
    debitModesAllowed: ["single"],
    defaultDebitMode: "single",
    fileRejectionModesAllowed: ["fail_full_file"],
    defaultFileRejectionMode: "fail_full_file"
  };
}

export function ProductCatalogPageClient() {
  const [banks, setBanks] = useState<BankTenant[]>([]);
  const [bankTenantId, setBankTenantId] = useState("bank-alpha");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Loading product catalog...");
  const [showPaymentMethodForm, setShowPaymentMethodForm] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [editingPackage, setEditingPackage] = useState<PackageEntry | null>(null);
  const [packageFormState, setPackageFormState] = useState(createDefaultPackageForm);

  useEffect(() => {
    void bootstrap();
  }, [bankTenantId]);

  async function bootstrap() {
    setStatusMessage("Loading product catalog...");

    try {
      const [banksResponse, paymentMethodResponse, packageResponse] = await Promise.all([
        fetchJson<{ items: BankTenant[] }>("/v1/tenants/banks"),
        fetchJson<{ items: PaymentMethod[] }>("/v1/package-catalog/payment-methods"),
        fetchJson<{ items: PackageEntry[] }>(
          `/v1/package-catalog/packages?ownerType=bank&bankTenantId=${encodeURIComponent(bankTenantId)}`
        )
      ]);

      const nextBanks = banksResponse.items ?? [];
      setBanks(nextBanks);
      if (!bankTenantId && nextBanks[0]) {
        setBankTenantId(nextBanks[0].tenantId);
      }

      setPaymentMethods(paymentMethodResponse.items ?? []);
      setPackages(packageResponse.items ?? []);
      setStatusMessage("Ready.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load the bank product catalog."
      );
    }
  }

  async function handlePaymentMethodSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      paymentMethodCode: String(formData.get("paymentMethodCode") ?? "").trim().toUpperCase(),
      displayName: String(formData.get("displayName") ?? "").trim(),
      minAmount: parseOptionalNumber(formData.get("minAmount")),
      maxAmount: parseOptionalNumber(formData.get("maxAmount")),
      cutoffTime: String(formData.get("cutoffTime") ?? "").trim(),
      status: formData.get("statusActive") === "on" ? "active" : "inactive"
    };

    const response = editingPaymentMethod
      ? await fetchJson<PaymentMethod>(
          `/v1/package-catalog/payment-methods/${encodeURIComponent(
            editingPaymentMethod.paymentMethodCode
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload)
          }
        )
      : await fetchJson<PaymentMethod>("/v1/package-catalog/payment-methods", {
          method: "POST",
          body: JSON.stringify(payload)
        });

    setPaymentMethods((current) =>
      [...current.filter((item) => item.paymentMethodCode !== response.paymentMethodCode), response].sort(
        (left, right) => left.paymentMethodCode.localeCompare(right.paymentMethodCode)
      )
    );
    setEditingPaymentMethod(null);
    setShowPaymentMethodForm(false);
    form.reset();
    setStatusMessage(
      editingPaymentMethod
        ? `${response.displayName} updated successfully.`
        : `${response.displayName} created successfully.`
    );
  }

  async function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      ownerType: "bank",
      bankTenantId,
      corporateTenantId: null,
      corporateId: null,
      basePackageCode: null,
      packageCode: String(formData.get("packageCode") ?? "").trim().toUpperCase(),
      displayName: String(formData.get("displayName") ?? "").trim(),
      description: optionalText(formData.get("description")) ?? null,
      useCase: packageFormState.useCase,
      allowedBeneficiaryTypes: packageFormState.allowedBeneficiaryTypes,
      bulkApproveEnabled: formData.get("bulkApproveEnabled") === "on",
      debitModesAllowed: packageFormState.debitModesAllowed,
      defaultDebitMode: packageFormState.defaultDebitMode,
      fileRejectionModesAllowed: packageFormState.fileRejectionModesAllowed,
      defaultFileRejectionMode: packageFormState.defaultFileRejectionMode,
      maxPaymentsPerBatch: Number(formData.get("maxPaymentsPerBatch") ?? 0),
      pricingDefaults: {
        platformFee: String(formData.get("platformFee") ?? "0").trim() || "0"
      },
      paymentMethodCodes: packageFormState.paymentMethodCodes,
      defaultPaymentMethodCode: packageFormState.defaultPaymentMethodCode,
      status: formData.get("statusActive") === "on" ? "active" : "inactive"
    };

    const response = editingPackage
      ? await fetchJson<PackageEntry>(
          `/v1/package-catalog/packages/by-id/${encodeURIComponent(editingPackage.packageId)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload)
          }
        )
      : await fetchJson<PackageEntry>("/v1/package-catalog/packages", {
          method: "POST",
          body: JSON.stringify(payload)
        });

    setPackages((current) =>
      [...current.filter((item) => item.packageId !== response.packageId), response].sort((left, right) =>
        left.packageCode.localeCompare(right.packageCode)
      )
    );
    setEditingPackage(null);
    setShowPackageForm(false);
    setPackageFormState(createDefaultPackageForm());
    form.reset();
    setStatusMessage(
      editingPackage
        ? `${response.name} updated successfully.`
        : `${response.name} published successfully.`
    );
  }

  async function togglePaymentMethodStatus(method: PaymentMethod) {
    const response = await fetchJson<PaymentMethod>(
      `/v1/package-catalog/payment-methods/${encodeURIComponent(method.paymentMethodCode)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          displayName: method.displayName,
          minAmount: method.minAmount,
          maxAmount: method.maxAmount,
          cutoffTime: method.cutoffTime,
          status: method.status === "active" ? "inactive" : "active"
        })
      }
    );

    setPaymentMethods((current) =>
      current.map((item) => (item.paymentMethodCode === response.paymentMethodCode ? response : item))
    );
  }

  async function togglePackageStatus(entry: PackageEntry) {
    const response = await fetchJson<PackageEntry>(
      `/v1/package-catalog/packages/by-id/${encodeURIComponent(entry.packageId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          ownerType: "bank",
          bankTenantId: entry.bankTenantId,
          corporateTenantId: null,
          corporateId: null,
          basePackageCode: entry.basePackageCode,
          displayName: entry.name,
          description: entry.description,
          useCase: entry.useCase,
          allowedBeneficiaryTypes: entry.allowedBeneficiaryTypes,
          bulkApproveEnabled: entry.bulkApproveEnabled,
          debitModesAllowed: entry.debitModesAllowed,
          defaultDebitMode: entry.defaultDebitMode,
          fileRejectionModesAllowed: entry.fileRejectionModesAllowed,
          defaultFileRejectionMode: entry.defaultFileRejectionMode,
          maxPaymentsPerBatch: entry.maxPaymentsPerBatch,
          pricingDefaults: entry.pricingDefaults,
          paymentMethodCodes: entry.paymentMethods.map((method) => method.paymentMethodCode),
          defaultPaymentMethodCode:
            entry.defaultPaymentMethodCode ?? entry.paymentMethods[0]?.paymentMethodCode ?? "",
          status: entry.status === "active" ? "inactive" : "active"
        })
      }
    );

    setPackages((current) =>
      current.map((item) => (item.packageId === response.packageId ? response : item))
    );
  }

  function editPackage(entry: PackageEntry) {
    setEditingPackage(entry);
    setPackageFormState({
      useCase: entry.useCase,
      allowedBeneficiaryTypes: entry.allowedBeneficiaryTypes,
      paymentMethodCodes: entry.paymentMethods.map((method) => method.paymentMethodCode),
      defaultPaymentMethodCode:
        entry.defaultPaymentMethodCode ?? entry.paymentMethods[0]?.paymentMethodCode ?? "",
      debitModesAllowed: entry.debitModesAllowed,
      defaultDebitMode: entry.defaultDebitMode,
      fileRejectionModesAllowed: entry.fileRejectionModesAllowed,
      defaultFileRejectionMode: entry.defaultFileRejectionMode
    });
    setShowPackageForm(true);
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Bank Ops Web</p>
          <h1>Product Catalog</h1>
          <p className="lead">
            Define bank-owned payment methods and publish base packages that corporates can later adopt or build upon.
          </p>
          <div className="hero-tags">
            <span>Bank-owned methods</span>
            <span>Base packages</span>
            <span>Ownership-correct catalog</span>
          </div>
        </div>
        <aside className="hero-side">
          <div className="hero-card">
            <span className="hero-card-label">Scope</span>
            <strong>Bank-owned catalog</strong>
            <p>Corporate-specific packages are now managed from the corporate web surface.</p>
          </div>
        </aside>
      </section>

      <section className="detail-panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Bank Context</p>
            <h2>Catalog Scope</h2>
          </div>
        </div>
        <label className="filter">
          <span>Bank tenant</span>
          <SingleSelectDropdown
            onSelect={setBankTenantId}
            options={banks.map((bank) => ({
              value: bank.tenantId,
              label: `${bank.name} (${bank.tenantId})`
            }))}
            placeholder="Select bank tenant"
            selectedValue={bankTenantId}
          />
        </label>
        <div className="docs-actions">
          <a className="mini-button docs-link" href="#payment-methods">
            Payment Methods
          </a>
          <a className="mini-button docs-link" href="#bank-packages">
            Bank Packages
          </a>
        </div>
      </section>

      <section className="layout">
        <section className="detail-panel" id="payment-methods">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Bank Payment Methods</p>
              <h2>Payment Methods</h2>
            </div>
            <button className="mini-button" onClick={() => { setEditingPaymentMethod(null); setShowPaymentMethodForm((c) => !c); }} type="button">
              {showPaymentMethodForm ? "Close form" : "Create payment method"}
            </button>
          </div>

          {showPaymentMethodForm ? (
            <form className="action-form" key={editingPaymentMethod?.paymentMethodCode ?? "create-method"} onSubmit={handlePaymentMethodSubmit}>
              <div className="action-grid">
                <label>
                  <span>Code</span>
                  <input defaultValue={editingPaymentMethod?.paymentMethodCode ?? ""} name="paymentMethodCode" readOnly={Boolean(editingPaymentMethod)} required />
                </label>
                <label>
                  <span>Display name</span>
                  <input defaultValue={editingPaymentMethod?.displayName ?? ""} name="displayName" required />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>Cutoff time</span>
                  <input defaultValue={editingPaymentMethod?.cutoffTime ?? "18:00"} name="cutoffTime" type="time" required />
                </label>
                <label>
                  <span>Minimum amount</span>
                  <input defaultValue={editingPaymentMethod?.minAmount ?? ""} name="minAmount" type="number" step="0.01" />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>Maximum amount</span>
                  <input defaultValue={editingPaymentMethod?.maxAmount ?? ""} name="maxAmount" type="number" step="0.01" />
                </label>
                <label className="ops-toggle-bank">
                  <input defaultChecked={editingPaymentMethod?.status !== "inactive"} name="statusActive" type="checkbox" />
                  <span>Status active</span>
                </label>
              </div>
              <div className="action-buttons">
                <button className="button button-primary">{editingPaymentMethod ? "Save method" : "Publish method"}</button>
              </div>
            </form>
          ) : null}

          <div className="queue-list">
            {paymentMethods.map((method) => (
              <article className="key-card" key={method.paymentMethodCode}>
                <div className="key-card-row">
                  <strong>{method.displayName}</strong>
                  <span className="state-pill">{method.status}</span>
                </div>
                <p className="queue-meta">
                  {method.paymentMethodCode} | Cutoff {method.cutoffTime}
                </p>
                <p className="queue-meta">
                  Limit: {formatRange(method.minAmount, method.maxAmount)}
                </p>
                <div className="action-buttons compact-actions">
                  <button className="mini-button" onClick={() => { setEditingPaymentMethod(method); setShowPaymentMethodForm(true); }} type="button">Edit</button>
                  <button className="mini-button" onClick={() => void togglePaymentMethodStatus(method)} type="button">
                    {method.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel" id="bank-packages">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Base Packages</p>
              <h2>Bank Packages</h2>
            </div>
            <button className="mini-button" onClick={() => { setEditingPackage(null); setPackageFormState(createDefaultPackageForm()); setShowPackageForm((c) => !c); }} type="button">
              {showPackageForm ? "Close form" : "Create base package"}
            </button>
          </div>

          {showPackageForm ? (
            <form className="action-form" key={editingPackage?.packageId ?? "create-package"} onSubmit={handlePackageSubmit}>
              <div className="action-grid">
                <label>
                  <span>Package code</span>
                  <input defaultValue={editingPackage?.packageCode ?? ""} name="packageCode" readOnly={Boolean(editingPackage)} required />
                </label>
                <label>
                  <span>Display name</span>
                  <input defaultValue={editingPackage?.name ?? ""} name="displayName" required />
                </label>
              </div>
              <label>
                <span>Use case</span>
                <SingleSelectDropdown
                  onSelect={(value) =>
                    setPackageFormState((current) => ({
                      ...current,
                      useCase: value
                    }))
                  }
                  options={[...PACKAGE_USE_CASE_OPTIONS]}
                  placeholder="Select use case"
                  selectedValue={packageFormState.useCase}
                />
              </label>
              <label>
                <span>Description</span>
                <textarea defaultValue={editingPackage?.description ?? ""} name="description" rows={3} />
              </label>
              <div className="action-grid">
                <label>
                  <span>Allowed beneficiary types</span>
                  <MultiSelectDropdown
                    onToggle={(value) =>
                      toggleChoice(
                        "allowedBeneficiaryTypes",
                        value,
                        packageFormState,
                        setPackageFormState
                      )
                    }
                    options={[...BENEFICIARY_TYPE_OPTIONS]}
                    placeholder="Choose beneficiary types"
                    selectedValues={packageFormState.allowedBeneficiaryTypes}
                  />
                </label>
                <label>
                  <span>Allowed payment methods</span>
                  <MultiSelectDropdown
                    onToggle={(value) =>
                      toggleChoice(
                        "paymentMethodCodes",
                        value,
                        packageFormState,
                        setPackageFormState
                      )
                    }
                    options={paymentMethods
                      .filter((method) => method.status === "active")
                      .map((method) => ({
                        value: method.paymentMethodCode,
                        label: `${method.displayName} (${method.paymentMethodCode})`
                      }))}
                    placeholder="Choose payment methods"
                    selectedValues={packageFormState.paymentMethodCodes}
                  />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>Default payment method</span>
                  <SingleSelectDropdown
                    onSelect={(value) =>
                      setPackageFormState((current) => ({
                        ...current,
                        defaultPaymentMethodCode: value
                      }))
                    }
                    options={paymentMethods
                      .filter((method) =>
                        packageFormState.paymentMethodCodes.includes(method.paymentMethodCode)
                      )
                      .map((method) => ({
                        value: method.paymentMethodCode,
                        label: `${method.displayName} (${method.paymentMethodCode})`
                      }))}
                    placeholder="Select default payment method"
                    selectedValue={packageFormState.defaultPaymentMethodCode}
                  />
                </label>
                <label>
                  <span>Allowed debit modes</span>
                  <MultiSelectDropdown
                    onToggle={(value) =>
                      toggleChoice(
                        "debitModesAllowed",
                        value,
                        packageFormState,
                        setPackageFormState
                      )
                    }
                    options={[...DEBIT_MODE_OPTIONS]}
                    placeholder="Choose allowed debit modes"
                    selectedValues={packageFormState.debitModesAllowed}
                  />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>File failure handling</span>
                  <SingleSelectDropdown
                    onSelect={(value) =>
                      setPackageFormState((current) => ({
                        ...current,
                        fileRejectionModesAllowed: [value],
                        defaultFileRejectionMode: value
                      }))
                    }
                    options={[...FILE_REJECTION_MODE_OPTIONS]}
                    placeholder="Select file failure handling"
                    selectedValue={packageFormState.fileRejectionModesAllowed[0] ?? ""}
                  />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>Max payments per batch</span>
                  <input defaultValue={editingPackage?.maxPaymentsPerBatch ?? 1000} name="maxPaymentsPerBatch" type="number" min={1} required />
                </label>
              </div>
              <div className="action-grid">
                <label>
                  <span>Platform fee</span>
                  <input defaultValue={typeof editingPackage?.pricingDefaults?.platformFee === "string" ? editingPackage.pricingDefaults.platformFee : "0"} name="platformFee" required />
                </label>
                <label className="ops-toggle-bank">
                  <input defaultChecked={editingPackage?.status !== "inactive"} name="statusActive" type="checkbox" />
                  <span>Status active</span>
                </label>
              </div>
              <label className="ops-toggle-bank">
                <input defaultChecked={editingPackage?.bulkApproveEnabled ?? false} name="bulkApproveEnabled" type="checkbox" />
                <span>Bulk approve enabled</span>
              </label>
              <div className="action-buttons">
                <button className="button button-primary">{editingPackage ? "Save package" : "Publish package"}</button>
              </div>
            </form>
          ) : null}

          <div className="queue-list">
            {packages.map((entry) => (
              <article className="key-card" key={entry.packageId}>
                <div className="key-card-row">
                  <strong>{entry.name}</strong>
                  <span className="state-pill">{entry.status}</span>
                </div>
                <p className="queue-meta">
                  {entry.packageCode} | {entry.useCase.replaceAll("_", " ")}
                </p>
                <p className="queue-meta">
                  Methods: {entry.paymentMethods.map((method) => method.paymentMethodCode).join(", ") || "None"}
                </p>
                <p className="queue-meta">
                  Default method: {entry.defaultPaymentMethodCode ?? "Not set"} | File rejection: {entry.defaultFileRejectionMode}
                </p>
                <div className="action-buttons compact-actions">
                  <button className="mini-button" onClick={() => editPackage(entry)} type="button">Edit</button>
                  <button className="mini-button" onClick={() => void togglePackageStatus(entry)} type="button">
                    {entry.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <pre className="response-box">{statusMessage}</pre>
    </>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? `Request failed for ${url}`);
  }

  return (await response.json()) as T;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  return Number(normalized);
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function formatRange(minAmount: number | null, maxAmount: number | null) {
  if (minAmount !== null && maxAmount !== null) {
    return `INR ${formatAmount(minAmount)} to INR ${formatAmount(maxAmount)}`;
  }
  if (minAmount !== null) {
    return `INR ${formatAmount(minAmount)} and above`;
  }
  if (maxAmount !== null) {
    return `Up to INR ${formatAmount(maxAmount)}`;
  }
  return "No limits";
}

function formatAmount(value: number) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function toggleChoice(
  key:
    | "allowedBeneficiaryTypes"
    | "paymentMethodCodes"
    | "debitModesAllowed"
    | "fileRejectionModesAllowed",
  value: string,
  state: ReturnType<typeof createDefaultPackageForm>,
  setState: Dispatch<SetStateAction<ReturnType<typeof createDefaultPackageForm>>>
) {
  setState((current) => {
    const nextValues = current[key].includes(value)
      ? current[key].filter((item) => item !== value)
      : [...current[key], value];
    const nextState = { ...current, [key]: nextValues };
    if (key === "paymentMethodCodes") {
      return {
        ...nextState,
        defaultPaymentMethodCode: nextValues.includes(current.defaultPaymentMethodCode)
          ? current.defaultPaymentMethodCode
          : nextValues[0] ?? ""
      };
    }
    if (key === "debitModesAllowed") {
      return {
        ...nextState,
        defaultDebitMode: nextValues.includes(current.defaultDebitMode)
          ? current.defaultDebitMode
          : nextValues[0] ?? ""
      };
    }
    if (key === "fileRejectionModesAllowed") {
      return {
        ...nextState,
        defaultFileRejectionMode: nextValues.includes(current.defaultFileRejectionMode)
          ? current.defaultFileRejectionMode
          : nextValues[0] ?? ""
      };
    }
    return nextState;
  });
}

function MultiSelectDropdown({
  options,
  selectedValues,
  onToggle,
  placeholder
}: {
  options: readonly SelectOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const container = detailsRef.current;

      if (container?.open && event.target instanceof Node && !container.contains(event.target)) {
        container.open = false;
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <details className="catalog-select" ref={detailsRef}>
      <summary className="catalog-select-trigger">
        <span className="catalog-select-summary">
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
        </span>
        <span className="catalog-select-caret" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="catalog-select-menu">
        {options.map((option) => {
          const selected = selectedValues.includes(option.value);

          return (
            <label
              className={`catalog-select-option catalog-select-option-checkbox${
                selected ? " selected" : ""
              }`}
              key={option.value}
            >
              <input
                checked={selected}
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
              <strong>{selected ? "Selected" : "Select"}</strong>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function SingleSelectDropdown({
  options,
  selectedValue,
  onSelect,
  placeholder
}: {
  options: readonly SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const selectedOption = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const container = detailsRef.current;

      if (container?.open && event.target instanceof Node && !container.contains(event.target)) {
        container.open = false;
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <details className="catalog-select" ref={detailsRef}>
      <summary className="catalog-select-trigger">
        <span className="catalog-select-summary">
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="catalog-select-caret" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="catalog-select-menu">
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <button
              aria-pressed={selected}
              className={`catalog-select-option${selected ? " selected" : ""}`}
              key={option.value}
              onClick={(event) => {
                onSelect(option.value);
                detailsRef.current?.removeAttribute("open");
              }}
              type="button"
            >
              <span>{option.label}</span>
              <strong>{selected ? "Current" : "Choose"}</strong>
            </button>
          );
        })}
      </div>
    </details>
  );
}
