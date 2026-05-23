"use client";

import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PackagesSection } from "./packages-section";
import { DebitAccountsSection } from "./debit-accounts-section";
import { TransactionDetailsBody } from "./detail-panels";

import {
  clearSession,
  persistSelectedCorporateId,
  readSelectedCorporateId,
  readSession
} from "../../../lib/session";
import type {
  ApprovalMatrix,
  BankTenant,
  Beneficiary,
  Corporate,
  CorporatePermission,
  CorporateRole,
  CorporateSession,
  OperationsInitialData,
  CorporateTenantSettings,
  CorporateTenant,
  CorporateUser,
  Notification,
  PayoutBatch,
  PayoutFileUpload,
  PayoutTimelineEvent,
  CorporateSubscription,
  CorporateDebitAccount
} from "../../../lib/types";

export type SectionId =
  | "home"
  | "transactions"
  | "file-uploads"
  | "beneficiaries"
  | "approvals"
  | "packages"
  | "debit-accounts"
  | "approval-matrices"
  | "roles"
  | "users"
  | "devportal"
  | "reports"
  | "audit"
  | "settings";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; raw?: unknown };

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type ApprovalEntry =
  | {
      entity: "transaction";
      id: string;
      title: string;
      meta: string;
      status: string;
      createdAt?: string;
    }
  | {
      entity: "beneficiary";
      id: string;
      title: string;
      meta: string;
      status: string;
      createdAt?: string;
    }
  | {
      entity: "role";
      id: string;
      title: string;
      meta: string;
      status: string;
      createdAt?: string;
    }
  | {
      entity: "user";
      id: string;
      title: string;
      meta: string;
      status: string;
      createdAt?: string;
    };

type ApprovalSectionFilter = "all" | ApprovalEntry["entity"];

type SetupAuditEntry = {
  id: string;
  entity: "role" | "user";
  itemName: string;
  action: "created" | "updated" | "approved" | "rejected";
  happenedAt: string | null;
  actorRole: string | null;
  state: string;
  remark: string | null;
};

function CompactMultiDropdown({
  label,
  options,
  values,
  onChange,
  placeholder
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
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
      if (!target.closest(`[data-compact-dropdown="${label}"]`)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [label]);

  return (
    <div data-compact-dropdown={label} style={{ position: "relative" }}>
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
            selectedLabels.slice(0, 2).map((item) => (
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
            <span style={{ color: "var(--text-secondary)" }}>{placeholder}</span>
          )}
          {selectedLabels.length > 2 ? (
            <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              +{selectedLabels.length - 2} more
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
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const checked = values.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange(
                      checked ? values.filter((value) => value !== option.value) : [...values, option.value]
                    )
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "10px 12px",
                    border: 0,
                    background: checked ? "var(--accent-soft)" : "transparent",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "999px",
                        border: `1px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
                        background: checked ? "var(--accent)" : "transparent",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700
                      }}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span>{option.label}</span>
                  </span>
                  <span style={{ color: checked ? "var(--accent)" : "var(--text-secondary)", fontSize: "12px" }}>
                    {checked ? "Selected" : "Add"}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={{ padding: "12px", color: "var(--text-secondary)", fontSize: "13px" }}>
              No matches
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const SECTIONS: Array<{ id: SectionId; label: string; accent: string }> = [
  { id: "home", label: "Home", accent: "Overview" },
  { id: "transactions", label: "Transactions", accent: "Payout desk" },
  { id: "file-uploads", label: "File Uploads", accent: "Bulk import history" },
  { id: "beneficiaries", label: "Beneficiaries", accent: "Directory" },
  { id: "approvals", label: "Approvals", accent: "Maker-checker queue" },
  { id: "packages", label: "Packages", accent: "Active subscriptions" },
  { id: "debit-accounts", label: "Debit Accounts", accent: "Corporate funding" },
  { id: "approval-matrices", label: "Approval Matrix", accent: "Rules engine" },
  { id: "roles", label: "Roles", accent: "Permission model" },
  { id: "users", label: "Users", accent: "Access roster" },
  { id: "devportal", label: "Dev Portal", accent: "Developer APIs" },
  { id: "reports", label: "Reports", accent: "Insights" },
  { id: "audit", label: "Audit Log", accent: "Traceability" },
  { id: "settings", label: "Settings", accent: "Workspace controls" }
];

const PRIMARY_SECTION_IDS: SectionId[] = [
  "home",
  "transactions",
  "file-uploads",
  "beneficiaries",
  "approvals"
];

const OTHER_SECTION_IDS: SectionId[] = [
  "approval-matrices",
  "roles",
  "users",
  "devportal",
  "reports",
  "audit",
  "settings"
];

const PERMISSION_GROUPS: Array<{
  label: string;
  items: Array<{ value: CorporatePermission; label: string }>;
}> = [
  {
    label: "Transactions",
    items: [
      { value: "transaction.make", label: "Transaction maker" },
      { value: "transaction.checker", label: "Transaction checker" }
    ]
  },
  {
    label: "Beneficiaries",
    items: [
      { value: "beneficiary.make", label: "Beneficiary maker" },
      { value: "beneficiary.checker", label: "Beneficiary checker" }
    ]
  },
  {
    label: "Roles",
    items: [
      { value: "roles.make", label: "Roles maker" },
      { value: "roles.checker", label: "Roles checker" }
    ]
  },
  {
    label: "Users",
    items: [
      { value: "user.make", label: "User maker" },
      { value: "user.checker", label: "User checker" }
    ]
  },
  {
    label: "Dev Portal",
    items: [
      { value: "devportal.view", label: "Dev portal view" },
      { value: "devportal.edit", label: "Dev portal edit" }
    ]
  },
  {
    label: "Settings",
    items: [
      { value: "settings.view", label: "Settings view" },
      { value: "settings.edit", label: "Settings edit" }
    ]
  }
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, CorporatePermission[]> = {
  maker: [
    "transaction.make",
    "beneficiary.make",
    "roles.make",
    "user.make",
    "devportal.view",
    "devportal.edit",
    "settings.view",
    "settings.edit"
  ],
  checker: [
    "transaction.checker",
    "beneficiary.checker",
    "roles.checker",
    "user.checker",
    "devportal.view",
    "devportal.edit",
    "settings.view",
    "settings.edit"
  ]
};

const APPROVAL_PERMISSION_MAP: Record<ApprovalEntry["entity"], CorporatePermission> = {
  transaction: "transaction.checker",
  beneficiary: "beneficiary.checker",
  role: "roles.checker",
  user: "user.checker"
};

type OperationsDashboardProps = {
  initialData: OperationsInitialData;
  initialSession: CorporateSession;
  initialSection: SectionId;
};

type RefreshWorkspaceOptions = {
  silent?: boolean;
};

export function OperationsDashboard({
  initialData,
  initialSession,
  initialSection
}: OperationsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const bootstrappedRef = useRef(false);
  const skipNextCorporateRefreshRef = useRef(Boolean(initialData.selectedCorporateId));
  const otherMenuRef = useRef<HTMLDetailsElement | null>(null);
  const notificationMenuRef = useRef<HTMLDetailsElement | null>(null);
  const paymentApprovalsRef = useRef<HTMLDivElement | null>(null);
  const beneficiaryApprovalsRef = useRef<HTMLDivElement | null>(null);
  const roleApprovalsRef = useRef<HTMLDivElement | null>(null);
  const userApprovalsRef = useRef<HTMLDivElement | null>(null);
  const autoRefreshInFlightRef = useRef(false);
  const latestSessionRef = useRef<CorporateSession | null>(initialSession);
  const latestCorporateIdRef = useRef(initialData.selectedCorporateId);

  const [session, setSession] = useState<CorporateSession | null>(initialSession);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const activeSection = useMemo<SectionId>(() => {
    if (!pathname) return initialSection;
    const parts = pathname.split("/");
    const operationsIndex = parts.indexOf("operations");
    if (operationsIndex !== -1 && parts[operationsIndex + 1]) {
      const sectionFromUrl = parts[operationsIndex + 1] as SectionId;
      if (SECTIONS.some((s) => s.id === sectionFromUrl)) {
        return sectionFromUrl;
      }
    }
    return initialSection;
  }, [pathname, initialSection]);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null);
  const [approvalSectionFilter, setApprovalSectionFilter] =
    useState<ApprovalSectionFilter>("all");
  const [selectedApprovalKey, setSelectedApprovalKey] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [bankTenants, setBankTenants] = useState<BankTenant[]>(initialData.bankTenants);
  const [corporateTenants, setCorporateTenants] = useState<CorporateTenant[]>(
    initialData.corporateTenants
  );
  const [corporates, setCorporates] = useState<Corporate[]>(initialData.corporates);
  const [settings, setSettings] = useState<CorporateTenantSettings | null>(initialData.settings);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(initialData.beneficiaries);
  const [transactions, setTransactions] = useState<PayoutBatch[]>(initialData.transactions);
  const [fileUploads, setFileUploads] = useState<PayoutFileUpload[]>(initialData.fileUploads);
  const [roles, setRoles] = useState<CorporateRole[]>(initialData.roles);
  const [users, setUsers] = useState<CorporateUser[]>(initialData.users);
  const [approvalMatrices, setApprovalMatrices] = useState<ApprovalMatrix[]>(
    initialData.approvalMatrices
  );
  const [subscriptions, setSubscriptions] = useState<CorporateSubscription[]>(
    initialData.subscriptions ?? []
  );
  const [debitAccounts, setDebitAccounts] = useState<CorporateDebitAccount[]>(
    initialData.debitAccounts ?? []
  );
  const [transactionDetailCache, setTransactionDetailCache] = useState<Record<string, PayoutBatch>>({});

  const [selectedCorporateId, setSelectedCorporateId] = useState(initialData.selectedCorporateId);

  const [showBeneficiaryCreate, setShowBeneficiaryCreate] = useState(false);
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<string | null>(null);
  const [beneficiaryActionItem, setBeneficiaryActionItem] = useState<Beneficiary | null>(null);
  const [beneficiaryActionMenuOpen, setBeneficiaryActionMenuOpen] = useState(false);
  const [showTransactionCreate, setShowTransactionCreate] = useState(false);
  const [showTransactionBulkUpload, setShowTransactionBulkUpload] = useState(false);
  const [showRoleCreate, setShowRoleCreate] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleActionItem, setRoleActionItem] = useState<CorporateRole | null>(null);
  const [roleActionMenuOpen, setRoleActionMenuOpen] = useState(false);
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [showApprovalMatrixCreate, setShowApprovalMatrixCreate] = useState(false);
  const [approvalMatrixSubscriptionId, setApprovalMatrixSubscriptionId] = useState("");
  const [approvalMatrixDebitAccountIds, setApprovalMatrixDebitAccountIds] = useState<string[]>([]);
  const [approvalMatrixRoleNames, setApprovalMatrixRoleNames] = useState<string[]>([]);
  const [settingsTab, setSettingsTab] = useState<"general" | "packages" | "debit-accounts">(
    "general"
  );
  const [selectedTransactionPackageCode, setSelectedTransactionPackageCode] = useState("");
  const [selectedTransactionDebitAccountId, setSelectedTransactionDebitAccountId] = useState("");
  const [selectedTransactionPaymentMethodCode, setSelectedTransactionPaymentMethodCode] =
    useState("");

  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [beneficiaryStatusFilter, setBeneficiaryStatusFilter] = useState("");
  const [beneficiaryPackageCodes, setBeneficiaryPackageCodes] = useState<string[]>([]);
  const editingRole = useMemo(
    () => (editingRoleId ? roles.find((item) => item.roleId === editingRoleId) ?? null : null),
    [editingRoleId, roles]
  );

  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStateFilter, setTransactionStateFilter] = useState("");
  const [dashboardDateRange, setDashboardDateRange] = useState("all");
  const [transactionDatePreset, setTransactionDatePreset] = useState("all");
  const [transactionCustomStart, setTransactionCustomStart] = useState("");
  const [transactionCustomEnd, setTransactionCustomEnd] = useState("");
  const [showTransactionDatePicker, setShowTransactionDatePicker] = useState(false);
  const [approvalDatePreset, setApprovalDatePreset] = useState("all");
  const [approvalCustomStart, setApprovalCustomStart] = useState("");
  const [approvalCustomEnd, setApprovalCustomEnd] = useState("");
  const [showApprovalDatePicker, setShowApprovalDatePicker] = useState(false);

  // Search and filter states per menu
  const [homeSearch, setHomeSearch] = useState("");
  const [fileUploadSearch, setFileUploadSearch] = useState("");
  const [fileUploadStatusFilter, setFileUploadStatusFilter] = useState("");
  const [approvalSearch, setApprovalSearch] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixStatusFilter, setMatrixStatusFilter] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [roleStatusFilter, setRoleStatusFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [reportDatePreset, setReportDatePreset] = useState("all");
  const [reportCustomStart, setReportCustomStart] = useState("");
  const [reportCustomEnd, setReportCustomEnd] = useState("");
  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("");

  const editingBeneficiary = useMemo(
    () => (editingBeneficiaryId ? beneficiaries.find((item) => item.beneficiaryId === editingBeneficiaryId) ?? null : null),
    [editingBeneficiaryId, beneficiaries]
  );

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard may be unavailable in some browsers
    }
  }

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    if (initialSession && initialData.selectedCorporateId) {
      if (initialData.selectedCorporateId) {
        persistSelectedCorporateId(initialData.selectedCorporateId);
      }
      return;
    }

    const currentSession = readSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }

    setSession(currentSession);
    void bootstrap(currentSession);
  }, [initialSession, router]);



  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    latestCorporateIdRef.current = selectedCorporateId;
  }, [selectedCorporateId]);

  async function bootstrap(currentSession: CorporateSession) {
    setLoading(true);
    const contextResult = await loadContext(currentSession);

    if (!contextResult.ok) {
      setNotice({ tone: "error", text: contextResult.message });
      setLoading(false);
      return;
    }

    setNotice(null);
    setLoading(false);
    void refreshWorkspace(currentSession, contextResult.corporateId);
  }

  async function loadContext(currentSession: CorporateSession) {
    const [banksResult, tenantsResult, corporatesResult] = await Promise.all([
      fetchJson<{ items: BankTenant[] }>("/v1/tenants/banks"),
      fetchJson<{ items: CorporateTenant[] }>(
        `/v1/tenants/corporates?status=active&bankTenantId=${encodeURIComponent(currentSession.bankTenantId)}`
      ),
      fetchJson<{ items: Corporate[] }>(
        `/v1/corporates?status=active&corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}`
      )
    ]);

    if (!banksResult.ok) {
      return { ok: false as const, message: banksResult.message };
    }

    if (!tenantsResult.ok) {
      return { ok: false as const, message: tenantsResult.message };
    }

    if (!corporatesResult.ok) {
      return { ok: false as const, message: corporatesResult.message };
    }

    const availableCorporates = corporatesResult.data.items ?? [];
    const preferredCorporateId =
      readSelectedCorporateId() ??
      currentSession.corporateId ??
      availableCorporates[0]?.corporateId ??
      "";

    setBankTenants(banksResult.data.items ?? []);
    setCorporateTenants(tenantsResult.data.items ?? []);
    setCorporates(availableCorporates);
    skipNextCorporateRefreshRef.current = true;
    setSelectedCorporateId(preferredCorporateId);
    if (preferredCorporateId) {
      persistSelectedCorporateId(preferredCorporateId);
    }

    return { ok: true as const, corporateId: preferredCorporateId };
  }

  async function refreshWorkspace(
    currentSession: CorporateSession,
    corporateId: string,
    options: RefreshWorkspaceOptions = {}
  ) {
    const silent = options.silent ?? false;

    if (!corporateId) {
      setTransactions([]);
      setFileUploads([]);
      setBeneficiaries([]);
      setRoles([]);
      setUsers([]);
      setSettings(null);
      setSubscriptions([]);
      setDebitAccounts([]);
      if (!silent) {
        setNotice({ tone: "info", text: "No child corporate is available for this user yet." });
      }
      return;
    }

    if (!silent) {
      setBusy(true);
    }
    const settingsRequest = hasPermission(currentSession, "settings.view")
      ? fetchJson<CorporateTenantSettings>(
          `/v1/settings/corporate-tenant?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&actedByUserId=${encodeURIComponent(currentSession.userId)}`
        )
      : Promise.resolve({
          ok: true as const,
          data: null
        });

    const [
      transactionsResult,
      fileUploadsResult,
      beneficiariesResult,
      approvalMatricesResult,
      rolesResult,
      usersResult,
      subscriptionsResult,
      debitAccountsResult,
      settingsResult
    ] = await Promise.all([
      fetchJson<{ items: PayoutBatch[] }>(
        `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetchJson<{ items: PayoutFileUpload[] }>(
        `/v1/payouts/file-uploads?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetchJson<{ items: Beneficiary[] }>(
        `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetchJson<{ items: ApprovalMatrix[] }>(
        `/v1/approval-matrices?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}`
      ),
      fetchJson<{ items: CorporateRole[] }>(
        `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}`
      ),
      fetchJson<{ items: CorporateUser[] }>(
        `/v1/auth/users?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetchJson<{ items: CorporateSubscription[] }>(
        `/v1/subscriptions?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      fetchJson<{ items: CorporateDebitAccount[] }>(
        `/v1/debit-accounts?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
      ),
      settingsRequest
    ]);

    if (transactionsResult.ok) {
      setTransactions(transactionsResult.data.items ?? []);
    }

    if (fileUploadsResult.ok) {
      setFileUploads(fileUploadsResult.data.items ?? []);
    }

    if (beneficiariesResult.ok) {
      setBeneficiaries(beneficiariesResult.data.items ?? []);
    }

    if (approvalMatricesResult.ok) {
      setApprovalMatrices(approvalMatricesResult.data.items ?? []);
    }

    if (rolesResult.ok) {
      setRoles(rolesResult.data.items ?? []);
    }

    if (usersResult.ok) {
      setUsers(usersResult.data.items ?? []);
    }
    if (subscriptionsResult.ok) {
      setSubscriptions(subscriptionsResult.data.items ?? []);
    }
    if (debitAccountsResult.ok) {
      setDebitAccounts(debitAccountsResult.data.items ?? []);
    }

    if (settingsResult.ok && settingsResult.data) {
      setSettings(settingsResult.data);
    }

    const failures = [
      transactionsResult,
      fileUploadsResult,
      beneficiariesResult,
      approvalMatricesResult,
      rolesResult,
      usersResult,
      subscriptionsResult,
      debitAccountsResult,
      settingsResult
    ].filter((result) => !result.ok);

    if (!silent && failures.length > 0) {
      setNotice({
        tone: "error",
        text: failures.map((result) => result.message).join(" | ")
      });
    }
    if (!silent) {
      setBusy(false);
    }
  }

  async function loadTransactionDetail(batchId: string) {
    if (transactionDetailCache[batchId]?.timeline.length) {
      return transactionDetailCache[batchId];
    }

    const result = await fetchJson<PayoutBatch>(`/v1/payouts/batches/${encodeURIComponent(batchId)}`);
    if (!result.ok) {
      return null;
    }

    setTransactionDetailCache((current) => ({
      ...current,
      [batchId]: result.data
    }));

    return result.data;
  }

  async function refreshNotifications(recipientUserId: string) {
    const result = await fetchJson<{ items: Notification[] }>(
      `/v1/notifications?recipientUserId=${encodeURIComponent(recipientUserId)}`
    );

    if (result.ok) {
      setNotifications(result.data.items ?? []);
    }
  }

  useEffect(() => {
    if (!session || !selectedCorporateId) {
      return;
    }

    if (skipNextCorporateRefreshRef.current) {
      skipNextCorporateRefreshRef.current = false;
      return;
    }

    persistSelectedCorporateId(selectedCorporateId);
    void refreshWorkspace(session, selectedCorporateId);
  }, [selectedCorporateId]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const menu = otherMenuRef.current;
      const notificationMenu = notificationMenuRef.current;

      if (event.target instanceof Node) {
        if (menu?.open && !menu.contains(event.target)) {
          menu.open = false;
        }

        if (notificationMenu?.open && !notificationMenu.contains(event.target)) {
          notificationMenu.open = false;
        }
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshNotifications(session.userId);
  }, [session]);

  useEffect(() => {
    async function runAutoRefresh() {
      if (document.hidden || autoRefreshInFlightRef.current) {
        return;
      }

      const currentSession = latestSessionRef.current;
      const corporateId = latestCorporateIdRef.current;

      if (!currentSession || !corporateId) {
        return;
      }

      autoRefreshInFlightRef.current = true;

      try {
        await Promise.all([
          refreshWorkspace(currentSession, corporateId, { silent: true }),
          refreshNotifications(currentSession.userId)
        ]);
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    }

    const refreshMs =
      activeSection === "transactions" ||
      activeSection === "file-uploads" ||
      activeSection === "approvals"
        ? 4000
        : 8000;

    const intervalId = window.setInterval(() => {
      void runAutoRefresh();
    }, refreshMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runAutoRefresh();
      }
    };

    const handleWindowFocus = () => {
      void runAutoRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [activeSection]);

  useEffect(() => {
    if (!activeTimelineId) {
      return;
    }

    const transaction = transactions.find((item) => item.batchId === activeTimelineId);
    if (!transaction || transaction.timeline.length > 0) {
      return;
    }

    void loadTransactionDetail(activeTimelineId);
  }, [activeTimelineId, transactions]);

  const isTransactionMaker = hasPermission(session, "transaction.make");
  const isBeneficiaryMaker = hasPermission(session, "beneficiary.make");
  const isRoleMaker = hasPermission(session, "roles.make");
  const isUserMaker = hasPermission(session, "user.make");
  const canViewDevPortal = hasPermission(session, "devportal.view");
  const canViewSettings = hasPermission(session, "settings.view");
  const canEditSettings = hasPermission(session, "settings.edit");
  const approvedTransactionCheckerRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.approvalState === "approved" &&
          role.status === "active" &&
          role.permissions.includes("transaction.checker")
      ),
    [roles]
  );

  const selectedCorporate = corporates.find(
    (corporate) => corporate.corporateId === selectedCorporateId
  );
  const selectedBank = bankTenants.find((bank) => bank.tenantId === session?.bankTenantId);
  const selectedTenant = corporateTenants.find(
    (tenant) => tenant.tenantId === session?.corporateTenantId
  );
  const avatarInitials = getInitials(session?.displayName ?? "User");
  const activeSectionLabel =
    SECTIONS.find((section) => section.id === activeSection)?.label ?? "Workspace";
  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const approvedBeneficiaries = useMemo(
    () =>
      beneficiaries.filter(
        (beneficiary) =>
          beneficiary.approvalState === "approved" && beneficiary.status === "active"
      ),
    [beneficiaries]
  );

  const packageAwareBeneficiaries = useMemo(
    () =>
      selectedTransactionPackageCode
        ? approvedBeneficiaries.filter((beneficiary) =>
            beneficiary.assignedPackages.some(
              (assignment) =>
                assignment.packageCode === selectedTransactionPackageCode
            )
          )
        : approvedBeneficiaries,
    [approvedBeneficiaries, selectedTransactionPackageCode]
  );

  const accessibleSubscriptions = useMemo(
    () =>
      subscriptions.filter(
        (subscription) =>
          subscription.status === "active" &&
          subscription.userAccess.some(
            (access) =>
              access.userId === session?.userId &&
              access.roleName === session?.role &&
              access.status === "active"
          )
      ),
    [session?.role, session?.userId, subscriptions]
  );

  const transactionPackageOptions = useMemo(
    () =>
      accessibleSubscriptions.map((subscription) => ({
        value: subscription.packageCode,
        label: `${subscription.displayName} (${subscription.packageCode})`
      })),
    [accessibleSubscriptions]
  );

  const selectedTransactionSubscription = useMemo(
    () =>
      accessibleSubscriptions.find(
        (subscription) => subscription.packageCode === selectedTransactionPackageCode
      ) ?? accessibleSubscriptions[0] ?? null,
    [accessibleSubscriptions, selectedTransactionPackageCode]
  );

  const selectedTransactionDebitAccounts = useMemo(
    () => selectedTransactionSubscription?.debitAccounts ?? [],
    [selectedTransactionSubscription]
  );

  const selectedTransactionDebitAccount = useMemo(
    () =>
      selectedTransactionDebitAccounts.find(
        (account) => account.debitAccountId === selectedTransactionDebitAccountId
      ) ?? null,
    [selectedTransactionDebitAccountId, selectedTransactionDebitAccounts]
  );

  const selectedTransactionPaymentMethods = useMemo(() => {
    const methodCodes = new Set<string>();
    for (const account of selectedTransactionDebitAccounts) {
      for (const code of account.allowedPaymentMethodCodes ?? []) {
        methodCodes.add(code);
      }
    }
    return [...methodCodes];
  }, [selectedTransactionDebitAccounts]);

  useEffect(() => {
    if (!selectedTransactionPackageCode && transactionPackageOptions.length > 0) {
      setSelectedTransactionPackageCode(transactionPackageOptions[0]?.value ?? "");
    }
  }, [selectedTransactionPackageCode, transactionPackageOptions]);

  useEffect(() => {
    if (!selectedTransactionSubscription) {
      return;
    }

    const defaultDebitAccountId =
      selectedTransactionSubscription.debitAccounts.find((account) => account.isDefault)?.debitAccountId ??
      selectedTransactionSubscription.debitAccounts[0]?.debitAccountId ??
      "";
    setSelectedTransactionDebitAccountId((current) => current || defaultDebitAccountId);

    const defaultPaymentMethodCode =
      selectedTransactionPaymentMethods[0] ??
      "";
    setSelectedTransactionPaymentMethodCode((current) => current || defaultPaymentMethodCode);
  }, [selectedTransactionPaymentMethods, selectedTransactionSubscription]);

  const approvedRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.approvalState === "approved" && role.status === "active"
      ),
    [roles]
  );

  const visibleOtherSections = useMemo(
    () =>
      OTHER_SECTION_IDS.filter((sectionId) => {
        if (sectionId === "devportal") {
          return canViewDevPortal;
        }

        if (sectionId === "settings") {
          return canViewSettings;
        }

        return true;
      }),
    [canViewDevPortal, canViewSettings]
  );

  const dashboardTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      if (dashboardDateRange === "all") return true;
      if (!t.createdAt) return false;
      const tDate = new Date(t.createdAt);
      const diffTime = Math.abs(now.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (dashboardDateRange === "today") return diffDays <= 1;
      if (dashboardDateRange === "7d") return diffDays <= 7;
      if (dashboardDateRange === "30d") return diffDays <= 30;
      return true;
    });
  }, [transactions, dashboardDateRange]);

  const dashboardVolume = useMemo(() => {
    return dashboardTransactions
      .filter(t => ["paid", "sent_to_bank", "approved"].includes(t.state))
      .reduce((sum, t) => sum + t.totalAmount.value, 0);
  }, [dashboardTransactions]);

  const buildDateRange = (preset: string, customStart: string, customEnd: string) => {
    const today = new Date();
    const startOfDay = (date: Date) => {
      const value = new Date(date);
      value.setHours(0, 0, 0, 0);
      return value;
    };
    const endOfDay = (date: Date) => {
      const value = new Date(date);
      value.setHours(23, 59, 59, 999);
      return value;
    };

    if (preset === "custom") {
      return {
        start: customStart ? startOfDay(new Date(customStart)) : null,
        end: customEnd ? endOfDay(new Date(customEnd)) : null
      };
    }

    if (preset === "today") {
      return { start: startOfDay(today), end: endOfDay(today) };
    }

    if (preset === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }

    if (preset === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      return { start: startOfDay(weekStart), end: endOfDay(today) };
    }

    if (preset === "month") {
      const monthStart = new Date(today);
      monthStart.setDate(1);
      return { start: startOfDay(monthStart), end: endOfDay(today) };
    }

    return { start: null, end: null };
  };

  const transactionDateRange = useMemo(
    () => buildDateRange(transactionDatePreset, transactionCustomStart, transactionCustomEnd),
    [transactionCustomEnd, transactionCustomStart, transactionDatePreset]
  );

  const approvalDateRange = useMemo(
    () => buildDateRange(approvalDatePreset, approvalCustomStart, approvalCustomEnd),
    [approvalCustomEnd, approvalCustomStart, approvalDatePreset]
  );

  const reportDateRange = useMemo(
    () => buildDateRange(reportDatePreset, reportCustomStart, reportCustomEnd),
    [reportCustomEnd, reportCustomStart, reportDatePreset]
  );

  const filteredReportTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.createdAt) return false;
      const createdAt = new Date(t.createdAt);
      return (
        (!reportDateRange.start || createdAt >= reportDateRange.start) &&
        (!reportDateRange.end || createdAt <= reportDateRange.end)
      );
    });
  }, [transactions, reportDateRange]);

  const activeTimelineTransaction = useMemo(() => {
    if (!activeTimelineId) {
      return null;
    }

    return (
      transactionDetailCache[activeTimelineId] ??
      transactions.find((transaction) => transaction.batchId === activeTimelineId) ??
      null
    );
  }, [activeTimelineId, transactionDetailCache, transactions]);

  const activeTransactionSubscription = useMemo(() => {
    if (!activeTimelineTransaction?.packageCode) {
      return null;
    }

    return (
      subscriptions.find((item) => item.packageCode === activeTimelineTransaction.packageCode) ??
      null
    );
  }, [activeTimelineTransaction, subscriptions]);

  const activeTransactionDebitAccount = useMemo(() => {
    if (!activeTimelineTransaction) {
      return null;
    }

    return (
      debitAccounts.find(
        (item) => item.debitAccountId === activeTimelineTransaction.debitAccountId
      ) ?? null
    );
  }, [activeTimelineTransaction, debitAccounts]);

  const filteredHomeTransactions = useMemo(() => {
    return dashboardTransactions.filter((transaction) => {
      const beneficiaryName =
        transaction.primaryBeneficiaryName ??
        beneficiaries.find((b) => b.beneficiaryId === transaction.primaryBeneficiaryId)?.name ??
        "Unknown";
      return (
        !homeSearch ||
        transaction.title.toLowerCase().includes(homeSearch.toLowerCase()) ||
        beneficiaryName.toLowerCase().includes(homeSearch.toLowerCase())
      );
    });
  }, [dashboardTransactions, homeSearch, beneficiaries]);

  const filteredFileUploads = useMemo(() => {
    return fileUploads.filter((file) => {
      const matchesSearch =
        !fileUploadSearch ||
        file.fileName.toLowerCase().includes(fileUploadSearch.toLowerCase()) ||
        (file.uploadedByName && file.uploadedByName.toLowerCase().includes(fileUploadSearch.toLowerCase())) ||
        file.uploadedByUserId.toLowerCase().includes(fileUploadSearch.toLowerCase());

      const matchesStatus = !fileUploadStatusFilter || file.status === fileUploadStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [fileUploads, fileUploadSearch, fileUploadStatusFilter]);

  const filteredApprovalMatrices = useMemo(() => {
    return approvalMatrices.filter((matrix) => {
      const matchesSearch =
        !matrixSearch ||
        matrix.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        matrix.roles.some((r) => r.toLowerCase().includes(matrixSearch.toLowerCase()));

      const matchesStatus = !matrixStatusFilter || matrix.status === matrixStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [approvalMatrices, matrixSearch, matrixStatusFilter]);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const matchesSearch =
        !roleSearch ||
        role.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
        role.roleId.toLowerCase().includes(roleSearch.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(roleSearch.toLowerCase())) ||
        role.permissions.some((p) => p.toLowerCase().includes(roleSearch.toLowerCase()));

      const matchesStatus = !roleStatusFilter || role.status === roleStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [roles, roleSearch, roleStatusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        !userSearch ||
        user.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.username.toLowerCase().includes(userSearch.toLowerCase());

      const matchesStatus = !userStatusFilter || user.status === userStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, userSearch, userStatusFilter]);

  const beneficiaryRows = useMemo(() => {
    return beneficiaries.filter((beneficiary) => {
      const searchTerm = beneficiarySearch.trim().toLowerCase();

      const matchesSearch =
        searchTerm.length === 0 ||
        beneficiary.name.toLowerCase().includes(searchTerm) ||
        beneficiary.beneficiaryId.toLowerCase().includes(searchTerm) ||
        beneficiary.accountNumber.includes(searchTerm);

      const matchesStatus =
        beneficiaryStatusFilter.length === 0 ||
        beneficiary.status === beneficiaryStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [beneficiaries, beneficiarySearch, beneficiaryStatusFilter]);

  const transactionRows = useMemo(() => {
    return transactions.filter((transaction) => {
      const searchTerm = transactionSearch.trim().toLowerCase();

      const matchesSearch =
        searchTerm.length === 0 ||
        transaction.batchId.toLowerCase().includes(searchTerm) ||
        transaction.title.toLowerCase().includes(searchTerm);

      const matchesState =
        transactionStateFilter.length === 0 ||
        transaction.state === transactionStateFilter;

      const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
      const matchesDate =
        !createdAt ||
        ((!transactionDateRange.start || createdAt >= transactionDateRange.start) &&
          (!transactionDateRange.end || createdAt <= transactionDateRange.end));

      return matchesSearch && matchesState && matchesDate;
    });
  }, [
    transactionDateRange.end,
    transactionDateRange.start,
    transactionSearch,
    transactionStateFilter,
    transactions
  ]);

  const approvalEntries = useMemo<ApprovalEntry[]>(() => {
    return [
      ...transactions
        .filter((item) => item.state === "pending_approval")
        .filter((item) => {
          if (!item.createdAt) {
            return true;
          }
          const createdAt = new Date(item.createdAt);
          return (
            (!approvalDateRange.start || createdAt >= approvalDateRange.start) &&
            (!approvalDateRange.end || createdAt <= approvalDateRange.end)
          );
        })
        .map((item) => ({
          entity: "transaction" as const,
          id: item.batchId,
          title: item.title,
          meta: `${item.batchId} | INR ${formatAmount(item.totalAmount.value)}`,
          status: item.state,
          createdAt: item.createdAt ?? undefined
        })),
      ...beneficiaries
        .filter((item) => item.approvalState === "pending_approval")
        .filter((item) => {
          if (!item.createdAt) {
            return true;
          }
          const createdAt = new Date(item.createdAt);
          return (
            (!approvalDateRange.start || createdAt >= approvalDateRange.start) &&
            (!approvalDateRange.end || createdAt <= approvalDateRange.end)
          );
        })
        .map((item) => ({
          entity: "beneficiary" as const,
          id: item.beneficiaryId,
          title: item.name,
          meta: `${maskAccountNumber(item.accountNumber)} | ${item.bankName}`,
          status: item.approvalState,
          createdAt: item.createdAt ?? undefined
        })),
      ...roles
        .filter((item) => item.approvalState === "pending_approval")
        .filter((item) => {
          if (!item.createdAt) {
            return true;
          }
          const createdAt = new Date(item.createdAt);
          return (
            (!approvalDateRange.start || createdAt >= approvalDateRange.start) &&
            (!approvalDateRange.end || createdAt <= approvalDateRange.end)
          );
        })
        .map((item) => ({
          entity: "role" as const,
          id: item.roleId,
          title: item.name,
          meta: item.description ?? "No description provided",
          status: item.approvalState,
          createdAt: item.createdAt ?? undefined
        })),
      ...users
        .filter((item) => item.approvalState === "pending_approval")
        .filter((item) => {
          if (!item.createdAt) {
            return true;
          }
          const createdAt = new Date(item.createdAt);
          return (
            (!approvalDateRange.start || createdAt >= approvalDateRange.start) &&
            (!approvalDateRange.end || createdAt <= approvalDateRange.end)
          );
        })
        .map((item) => ({
          entity: "user" as const,
          id: item.userId,
          title: item.displayName,
          meta: `${item.username} | ${item.role}`,
          status: item.approvalState,
          createdAt: item.createdAt ?? undefined
        }))
    ];
  }, [approvalDateRange.end, approvalDateRange.start, beneficiaries, roles, transactions, users]);

  const paymentApprovalEntries = useMemo(
    () => approvalEntries.filter((entry) => entry.entity === "transaction"),
    [approvalEntries]
  );
  const beneficiaryApprovalEntries = useMemo(
    () => approvalEntries.filter((entry) => entry.entity === "beneficiary"),
    [approvalEntries]
  );
  const roleApprovalEntries = useMemo(
    () => approvalEntries.filter((entry) => entry.entity === "role"),
    [approvalEntries]
  );
  const userApprovalEntries = useMemo(
    () => approvalEntries.filter((entry) => entry.entity === "user"),
    [approvalEntries]
  );

  const selectedApprovalEntry = useMemo(() => {
    if (!selectedApprovalKey) {
      return null;
    }

    return (
      approvalEntries.find((entry) => `${entry.entity}:${entry.id}` === selectedApprovalKey) ?? null
    );
  }, [approvalEntries, selectedApprovalKey]);

  const selectedApprovalDetail = useMemo(() => {
    if (!selectedApprovalEntry) {
      return null;
    }

    if (selectedApprovalEntry.entity === "transaction") {
      const transaction = (selectedApprovalEntry.entity === "transaction"
        ? transactionDetailCache[selectedApprovalEntry.id]
        : null) ??
        transactions.find(
        (item) => item.batchId === selectedApprovalEntry.id
      );
      if (!transaction) {
        return null;
      }

      const beneficiaryName =
        transaction.primaryBeneficiaryName ??
        beneficiaries.find(
          (beneficiary) =>
            beneficiary.beneficiaryId === transaction.primaryBeneficiaryId
        )?.name ??
        transaction.primaryBeneficiaryId ??
        "Unknown beneficiary";

      return {
        headline: transaction.title,
        badge: transaction.state,
        lines: [
          `Transaction Reference: ${transaction.title}`,
          `Txn UUID: ${transaction.batchId}`,
          `Beneficiary: ${beneficiaryName}`,
          `Amount: INR ${formatAmount(transaction.totalAmount.value)}`,
          `Tag: ${transaction.tag ?? "Not tagged"}`,
          `Remark: ${transaction.remark ?? "No remark"}`,
          `Approval level: ${transaction.currentApprovalLevel ?? 1} of ${transaction.approvalLevelsRequired ?? 1}`,
          `Roles allowed to approve: ${transaction.approvalRoles.join(", ") || "Any transaction checker"}`
        ],
        timeline: transaction.timeline
      };
    }

    if (selectedApprovalEntry.entity === "beneficiary") {
      const beneficiary = beneficiaries.find(
        (item) => item.beneficiaryId === selectedApprovalEntry.id
      );
      if (!beneficiary) {
        return null;
      }

      return {
        headline: beneficiary.name,
        badge: beneficiary.approvalState,
        lines: [
          `Bene ID: ${beneficiary.beneficiaryId}`,
          `Account: ${maskAccountNumber(beneficiary.accountNumber)}`,
          `Bank: ${beneficiary.bankName}`,
          `IFSC: ${beneficiary.ifsc}`,
          `Category: ${beneficiary.category ?? "Uncategorized"}`,
          `Tags: ${beneficiary.tags.join(", ") || "No tags"}`
        ],
        timeline: [] as PayoutTimelineEvent[]
      };
    }

    if (selectedApprovalEntry.entity === "role") {
      const role = roles.find((item) => item.roleId === selectedApprovalEntry.id);
      if (!role) {
        return null;
      }

      return {
        headline: role.name,
        badge: role.approvalState,
        lines: [
          `Role ID: ${role.roleId}`,
          `Description: ${role.description ?? "No description"}`,
          `Permissions: ${role.permissions.join(", ") || "No permissions"}`,
          `Status request: ${role.status}`
        ],
        timeline: [] as PayoutTimelineEvent[]
      };
    }

    const user = users.find((item) => item.userId === selectedApprovalEntry.id);
    if (!user) {
      return null;
    }

    return {
      headline: user.displayName,
      badge: user.approvalState,
      lines: [
        `User ID: ${user.userId}`,
        `Username: ${user.username}`,
        `Role: ${user.role}`,
        `Requested status: ${user.status}`,
        `Corporate scope: ${user.corporateId ?? "Parent tenant access"}`
      ],
      timeline: [] as PayoutTimelineEvent[]
    };
  }, [
    beneficiaries,
    roles,
    selectedApprovalEntry,
    transactionDetailCache,
    transactions,
    users
  ]);

  const setupAuditEntries = useMemo<SetupAuditEntry[]>(() => {
    const roleEntries = roles.flatMap((role) => {
      const entries: SetupAuditEntry[] = [];

      entries.push({
        id: `${role.roleId}:created`,
        entity: "role",
        itemName: role.name,
        action: "created",
        happenedAt: role.createdAt,
        actorRole: role.createdByRole,
        state: role.approvalState,
        remark: role.reviewComment
      });

      if (role.reviewedAt) {
        entries.push({
          id: `${role.roleId}:${role.approvalState}`,
          entity: "role",
          itemName: role.name,
          action: role.approvalState === "approved" ? "approved" : "rejected",
          happenedAt: role.reviewedAt,
          actorRole: role.reviewedByRole,
          state: role.approvalState,
          remark: role.reviewComment
        });
      }

      return entries;
    });

    const userEntries = users.flatMap((user) => {
      const entries: SetupAuditEntry[] = [];

      entries.push({
        id: `${user.userId}:created`,
        entity: "user",
        itemName: user.displayName,
        action: "created",
        happenedAt: user.createdAt,
        actorRole: user.createdByRole,
        state: user.approvalState,
        remark: user.reviewComment
      });

      if (user.reviewedAt) {
        entries.push({
          id: `${user.userId}:${user.approvalState}`,
          entity: "user",
          itemName: user.displayName,
          action: user.approvalState === "approved" ? "approved" : "rejected",
          happenedAt: user.reviewedAt,
          actorRole: user.reviewedByRole,
          state: user.approvalState,
          remark: user.reviewComment
        });
      }

      return entries;
    });

    return [...roleEntries, ...userEntries].sort((left, right) => {
      const leftTime = left.happenedAt ? new Date(left.happenedAt).getTime() : 0;
      const rightTime = right.happenedAt ? new Date(right.happenedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [roles, users]);

  const filteredAuditEntries = useMemo(() => {
    return setupAuditEntries.filter((entry) => {
      const matchesSearch =
        !auditSearch ||
        entry.itemName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (entry.actorRole && entry.actorRole.toLowerCase().includes(auditSearch.toLowerCase())) ||
        (entry.remark && entry.remark.toLowerCase().includes(auditSearch.toLowerCase()));

      const matchesEntity = !auditEntityFilter || entry.entity === auditEntityFilter;

      return matchesSearch && matchesEntity;
    });
  }, [setupAuditEntries, auditSearch, auditEntityFilter]);

  function jumpToApprovalSection(filter: ApprovalSectionFilter) {
    setApprovalSectionFilter(filter);

    const sectionRef =
      filter === "transaction"
        ? paymentApprovalsRef
        : filter === "beneficiary"
          ? beneficiaryApprovalsRef
          : filter === "role"
            ? roleApprovalsRef
            : filter === "user"
              ? userApprovalsRef
              : null;

    if (filter === "all" || !sectionRef?.current) {
      return;
    }

    sectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const transactionStateSummary = useMemo(() => {
    return transactions.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.state] = (accumulator[item.state] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [transactions]);

  const reportTransactionStateSummary = useMemo(() => {
    return filteredReportTransactions.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.state] = (accumulator[item.state] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [filteredReportTransactions]);

  const reportMetrics = useMemo(() => {
    const approvalPendingCount = approvalEntries.length;
    const approvedBeneficiaryCount = beneficiaries.filter(
      (beneficiary) =>
        beneficiary.approvalState === "approved" && beneficiary.status === "active"
    ).length;
    const totalUploadedRows = fileUploads.reduce(
      (sum, upload) => sum + upload.totalRows,
      0
    );
    const totalProcessedAmount = filteredReportTransactions
      .filter((transaction) =>
        ["approved", "sent_to_bank", "paid"].includes(
          transaction.state
        )
      )
      .reduce((sum, transaction) => sum + transaction.totalAmount.value, 0);

    const transactionStatusRows = Object.entries(reportTransactionStateSummary)
      .sort((left, right) => right[1] - left[1])
      .map(([state, count]) => ({
        state,
        count,
        share:
          filteredReportTransactions.length > 0
            ? Math.round((count / filteredReportTransactions.length) * 100)
            : 0
      }));

    const beneficiaryCategoryRows = Object.entries(
      beneficiaries.reduce<Record<string, number>>((accumulator, beneficiary) => {
        const category = beneficiary.category?.trim() || "Uncategorized";
        accumulator[category] = (accumulator[category] ?? 0) + 1;
        return accumulator;
      }, {})
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count
      }));

    const uploadStatusRows = Object.entries(
      fileUploads.reduce<Record<string, number>>((accumulator, upload) => {
        accumulator[upload.status] = (accumulator[upload.status] ?? 0) + 1;
        return accumulator;
      }, {})
    )
      .sort((left, right) => right[1] - left[1])
      .map(([status, count]) => ({
        status,
        count
      }));

    const recentTransactions = [...filteredReportTransactions]
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 5);

    return {
      approvalPendingCount,
      approvedBeneficiaryCount,
      totalUploadedRows,
      totalProcessedAmount,
      transactionStatusRows,
      beneficiaryCategoryRows,
      uploadStatusRows,
      recentTransactions
    };
  }, [approvalEntries, beneficiaries, fileUploads, reportTransactionStateSummary, filteredReportTransactions]);

  const filteredReportRecentTransactions = useMemo(() => {
    return reportMetrics.recentTransactions.filter((transaction) => {
      if (!reportSearch) return true;
      return (
        transaction.title.toLowerCase().includes(reportSearch.toLowerCase()) ||
        transaction.batchId.toLowerCase().includes(reportSearch.toLowerCase())
      );
    });
  }, [reportMetrics.recentTransactions, reportSearch]);

  async function handleBeneficiarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isBeneficiaryMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (beneficiaryPackageCodes.length === 0) {
      setNotice({ tone: "error", text: "Please attach at least one package to the beneficiary." });
      return;
    }
    const payload = {
      createdByUserId: session.userId,
      bankTenantId: session.bankTenantId,
      corporateTenantId: session.corporateTenantId,
      corporateId: selectedCorporateId,
      beneficiaryId: String(formData.get("beneficiaryId")),
      name: String(formData.get("name")),
      accountNumber: String(formData.get("accountNumber")),
      ifsc: String(formData.get("ifsc")),
      phoneNumber: String(formData.get("phoneNumber")),
      category: optionalText(formData.get("category")),
      tags: csvToArray(formData.get("tags")),
      packageCodes: beneficiaryPackageCodes
    };

    const isEdit = Boolean(editingBeneficiaryId);
    const result = isEdit
      ? await postJson<Beneficiary>(
          `/v1/beneficiaries/${encodeURIComponent(editingBeneficiaryId as string)}`,
          {
            ...payload,
            actedByUserId: session.userId
          }
        )
      : await postJson<Beneficiary>("/v1/beneficiaries", payload);
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setBeneficiaries((current) => [result.data, ...current.filter((item) => item.beneficiaryId !== result.data.beneficiaryId)]);
    form.reset();
    setBeneficiaryPackageCodes([]);
    setShowBeneficiaryCreate(false);
    setEditingBeneficiaryId(null);
    setNotice({
      tone: "success",
      text: isEdit
        ? `${payload.name} updated successfully and sent for approval.`
        : `${payload.name} created successfully and sent for approval.`
    });
  }

  function beginEditBeneficiary(beneficiary: Beneficiary) {
    setBeneficiaryActionItem(null);
    setBeneficiaryActionMenuOpen(false);
    setEditingBeneficiaryId(beneficiary.beneficiaryId);
    setShowBeneficiaryCreate(true);
    setBeneficiaryPackageCodes(beneficiary.assignedPackages.map((item) => item.packageCode));
  }

  async function handleBeneficiaryStatusAction(
    beneficiaryId: string,
    action: "activate" | "deactivate"
  ) {
    if (!session || !isBeneficiaryMaker) {
      return;
    }

    setBusy(true);
    const result = await postJson(
      `/v1/beneficiaries/${encodeURIComponent(beneficiaryId)}/status`,
      {
        action,
        actedByUserId: session.userId,
        comment: `${capitalize(action)}d by maker ${session.username}`
      }
    );
    setBusy(false);

    setNotice({
      tone: result.ok ? "success" : "error",
      text:
        result.ok
          ? `Beneficiary ${action === "activate" ? "activated" : "deactivated"} successfully.`
          : result.message
    });

    if (result.ok) {
      setBeneficiaries((current) =>
        current.map((item) =>
          item.beneficiaryId === beneficiaryId
            ? { ...item, status: action === "activate" ? "active" : "inactive" }
            : item
        )
      );
      void refreshWorkspace(session, selectedCorporateId);
    }
  }

  function openBeneficiaryActions(beneficiary: Beneficiary) {
    setBeneficiaryActionItem(beneficiary);
    setBeneficiaryActionMenuOpen(true);
  }

  async function updateBeneficiaryStatusFromMenu(action: "activate" | "deactivate") {
    if (!beneficiaryActionItem) {
      return;
    }

    await handleBeneficiaryStatusAction(beneficiaryActionItem.beneficiaryId, action);
    setBeneficiaryActionMenuOpen(false);
    setBeneficiaryActionItem(null);
  }

  async function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isTransactionMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const batchId = cryptoAvailableUuid();
    const beneficiaryId = String(formData.get("beneficiaryId"));
    const payload = {
      batchId,
      bankTenantId: session.bankTenantId,
      corporateTenantId: session.corporateTenantId,
      corporateId: selectedCorporateId,
      createdByUserId: session.userId,
      packageCode: selectedTransactionPackageCode || undefined,
      debitAccountId: selectedTransactionDebitAccountId || undefined,
      paymentMethodCode: selectedTransactionPaymentMethodCode || undefined,
      title: String(formData.get("transactionReference")),
      tag: optionalText(formData.get("tag")),
      remark: optionalText(formData.get("remark")),
      items: [
        {
          itemId: createSimpleId("ITEM"),
          beneficiaryId,
          amount: {
            value: Number(formData.get("amount")),
            currency: "INR"
          },
          purpose:
            optionalText(formData.get("remark")) ??
            String(formData.get("transactionReference"))
        }
      ]
    };

    setBusy(true);
    const result = await postJson<{
      message?: string;
      commandId: string;
      status: "accepted";
      transactionReference: string;
      acceptedAt: string;
    }>("/v1/payouts/transactions", payload);
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    form.reset();
    setShowTransactionCreate(false);
    setNotice({
      tone: "success",
      text:
        result.data.message ??
        `${payload.title} accepted for background processing. It will appear here shortly.`
    });
    window.setTimeout(() => {
      void refreshWorkspace(session, selectedCorporateId);
    }, 1200);
  }

  async function handleBulkTransactionUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isTransactionMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("corporateId", selectedCorporateId);

    setBusy(true);
    const response = await fetch("/api/payouts/bulk-upload", {
      method: "POST",
      body: formData
    });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      errors?: string[];
      fileUpload?: PayoutFileUpload | null;
      summary?: {
        totalRows: number;
        createdCount: number;
        rejectedCount: number;
      };
      rejected?: Array<{ rowNumber: number; transactionReference: string; reason: string }>;
      created?: PayoutBatch[];
    };
    setBusy(false);

    if (!response.ok) {
      if (data.fileUpload) {
        setFileUploads((current) => [
          data.fileUpload!,
          ...current.filter((item) => item.uploadId !== data.fileUpload!.uploadId)
        ]);
      }

      setNotice({
        tone: "error",
        text:
          data.errors?.[0] ??
          data.message ??
          "Bulk upload failed. Please check the uploaded file."
      });
      return;
    }

    if (data.fileUpload) {
      setFileUploads((current) => [
        data.fileUpload!,
        ...current.filter((item) => item.uploadId !== data.fileUpload!.uploadId)
      ]);
    }

    form.reset();
    setShowTransactionBulkUpload(false);
    setNotice({
      tone: "success",
      text:
        data.message ??
        `${data.fileUpload?.fileName ?? "File"} accepted for background processing.`
    });
    void refreshWorkspace(session, selectedCorporateId);
  }

  async function handleApprovalMatrixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isRoleMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const roles = formData
      .getAll("roles")
      .map((value) => String(value))
      .filter(Boolean);
    const selectedRoles = approvalMatrixRoleNames.length > 0 ? approvalMatrixRoleNames : roles;

    if (!approvalMatrixSubscriptionId) {
      setNotice({ tone: "error", text: "Please select a package subscription." });
      return;
    }

    if (approvalMatrixDebitAccountIds.length === 0) {
      setNotice({ tone: "error", text: "Please select at least one debit account." });
      return;
    }

    setBusy(true);
    const result = await postJson<ApprovalMatrix>("/v1/approval-matrices", {
      name: String(formData.get("name")),
      corporateTenantId: session.corporateTenantId,
      createdByUserId: session.userId,
      subscriptionId: approvalMatrixSubscriptionId,
      debitAccountIds: approvalMatrixDebitAccountIds,
      amountFrom: Number(formData.get("amountFrom")),
      amountTo: Number(formData.get("amountTo")),
      approvalLevels: Number(formData.get("approvalLevels")),
      roles: selectedRoles,
      status: "active"
    });
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setApprovalMatrices((current) => [result.data, ...current]);
    form.reset();
    setApprovalMatrixSubscriptionId("");
    setApprovalMatrixDebitAccountIds([]);
    setApprovalMatrixRoleNames([]);
    setShowApprovalMatrixCreate(false);
    setNotice({
      tone: "success",
      text: "Approval matrix created successfully."
    });
  }

  async function handleApproval(
    entity: ApprovalEntry["entity"],
    id: string,
    action: "approve" | "reject"
  ) {
    if (!session) {
      return;
    }

    const permissionMap: Record<ApprovalEntry["entity"], CorporatePermission> = {
      transaction: "transaction.checker",
      beneficiary: "beneficiary.checker",
      role: "roles.checker",
      user: "user.checker"
    };

    if (!hasPermission(session, permissionMap[entity])) {
      return;
    }

    const endpoint =
      entity === "transaction"
        ? `/v1/payouts/batches/${encodeURIComponent(id)}/actions`
        : entity === "beneficiary"
          ? `/v1/beneficiaries/${encodeURIComponent(id)}/actions`
          : entity === "role"
            ? `/v1/auth/corporate-roles/${encodeURIComponent(id)}/actions`
            : `/v1/auth/users/${encodeURIComponent(id)}/actions`;

    setBusy(true);
    const result = await postJson(endpoint, {
      action,
      actedByUserId: session.userId,
      comment:
        approvalComment.trim() || `${capitalize(action)}d by checker ${session.username}`
    });
    setBusy(false);

    setNotice({
      tone: result.ok ? "success" : "error",
      text:
        result.ok
          ? `${capitalize(entity)} ${action}d successfully.`
          : result.message
    });

    if (result.ok) {
      setApprovalComment("");
      setSelectedApprovalKey(null);
      void refreshWorkspace(session, selectedCorporateId);
    } else if (
      result.message ===
      "An action is already in progress by another user, please recheck the status after sometime"
    ) {
      setApprovalComment("");
      setSelectedApprovalKey(null);
      void refreshWorkspace(session, selectedCorporateId);
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (!session) {
      return;
    }

    if (!notification.readAt) {
      await postJson(
        `/v1/notifications/${encodeURIComponent(notification.notificationId)}/read`,
        {
          actedByUserId: session.userId
        }
      );

      setNotifications((current) =>
        current.map((item) =>
          item.notificationId === notification.notificationId
            ? { ...item, readAt: new Date().toISOString() }
            : item
        )
      );
    }

    notificationMenuRef.current?.removeAttribute("open");
    navigateToSection(notification.targetSection as SectionId);
  }

  async function handleMarkAllNotificationsRead() {
    if (!session) {
      return;
    }

    await postJson("/v1/notifications/read-all", {
      actedByUserId: session.userId
    });

    setNotifications((current) =>
      current.map((item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() }
      )
    );
  }

  async function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isRoleMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const permissions = PERMISSION_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => formData.getAll("permissions").includes(item.value))
        .map((item) => item.value)
    );

    const payload = {
      createdByUserId: session.userId,
      corporateTenantId: session.corporateTenantId,
      name: String(formData.get("name")),
      description: optionalText(formData.get("description")),
      permissions,
      status: String(formData.get("status"))
    };

    setBusy(true);
    const result = editingRoleId
      ? await postJson<CorporateRole>(`/v1/auth/corporate-roles/${encodeURIComponent(editingRoleId)}`, payload)
      : await postJson<CorporateRole>("/v1/auth/corporate-roles", payload);
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setRoles((current) => [result.data, ...current.filter((item) => item.roleId !== result.data.roleId)]);
    form.reset();
    setShowRoleCreate(false);
    setEditingRoleId(null);
    setNotice({
      tone: "success",
      text: `${String(formData.get("name"))} ${editingRoleId ? "updated" : "created"} successfully and sent for approval.`
    });
  }

  function beginEditRole(role: CorporateRole) {
    setRoleActionItem(null);
    setRoleActionMenuOpen(false);
    setEditingRoleId(role.roleId);
    setShowRoleCreate(true);
  }

  async function updateRoleStatus(role: CorporateRole, nextStatus: "active" | "inactive") {
    setRoleActionItem(null);
    setRoleActionMenuOpen(false);

    const result = await postJson<CorporateRole>(`/v1/auth/corporate-roles/${encodeURIComponent(role.roleId)}`, {
      createdByUserId: session?.userId ?? "",
      corporateTenantId: session?.corporateTenantId ?? role.corporateTenantId,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      status: nextStatus
    });

    setNotice({
      tone: result.ok ? "success" : "error",
      text: result.ok ? `Role ${nextStatus === "active" ? "activated" : "deactivated"} successfully.` : result.message
    });

    if (result.ok) {
      setRoles((current) => [result.data, ...current.filter((item) => item.roleId !== result.data.roleId)]);
      void refreshWorkspace(session!, selectedCorporateId, { silent: true });
    }
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isUserMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    const result = await postJson<CorporateUser>("/v1/auth/users", {
      userId: createSimpleId("USR"),
      createdByUserId: session.userId,
      username: String(formData.get("username")),
      password: String(formData.get("password")),
      displayName: String(formData.get("displayName")),
      role: String(formData.get("role")),
      bankTenantId: session.bankTenantId,
      corporateTenantId: session.corporateTenantId,
      corporateId: selectedCorporateId,
      status: String(formData.get("status"))
    });
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setUsers((current) => [result.data, ...current.filter((item) => item.userId !== result.data.userId)]);
    form.reset();
    setShowUserCreate(false);
    setNotice({
      tone: "success",
      text: `${String(formData.get("displayName"))} created successfully and sent for approval.`
    });
  }

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canEditSettings) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setBusy(true);
    const result = await postJson<CorporateTenantSettings>("/v1/settings/corporate-tenant", {
      corporateTenantId: session.corporateTenantId,
      actedByUserId: session.userId,
      companyDisplayName: String(formData.get("companyDisplayName") ?? "").trim(),
      supportEmail: optionalText(formData.get("supportEmail")),
      supportPhone: optionalText(formData.get("supportPhone")),
      registeredAddress: optionalText(formData.get("registeredAddress")),
      defaultApprovalNoteTemplate: optionalText(
        formData.get("defaultApprovalNoteTemplate")
      ),
      maxSingleTransactionAmount: Number(formData.get("maxSingleTransactionAmount") ?? 0),
      maxDailyCumulativeTransactionAmount: Number(
        formData.get("maxDailyCumulativeTransactionAmount") ?? 0
      ),
      maxBulkUploadRows: Number(formData.get("maxBulkUploadRows") ?? 0),
      duplicateReferencePolicy: formData.get("duplicateReferencePolicy") === "on"
        ? "enabled"
        : "disabled"
    });
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setSettings(result.data);
    setNotice({
      tone: "success",
      text: "Settings updated successfully."
    });
  }

  function handleLogout() {
    clearSession();
    window.location.assign("/logout");
  }

  function navigateToSection(section: SectionId) {
    router.push(`/operations/${section}`);
  }

  if (loading || !session) {
    return (
      <div className="ops-shell">
        <main className="ops-main">
          <section className="ops-header">
            <p className="ops-kicker">Future Pay</p>
            <h2>Preparing your workspace</h2>
            <p className="ops-copy">Loading your live operating context and saved permissions.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="ops-shell">
      <main className="ops-main">
        <header className="ops-topbar">
          <div className="ops-topbar-left">
            <div className="ops-logo">FP</div>
            <div>
              <p className="ops-kicker">Future Pay</p>
              <h1 className="ops-product-title">
                {selectedCorporate?.name ?? selectedTenant?.name ?? "Corporate Operations"}
              </h1>
            </div>
          </div>

          <nav className="ops-topnav">
            {SECTIONS.filter((section) => PRIMARY_SECTION_IDS.includes(section.id)).map((section) => (
              <button
                key={section.id}
                className={activeSection === section.id ? "active" : undefined}
                onClick={() => navigateToSection(section.id)}
                type="button"
              >
                {section.label}
              </button>
            ))}
            <details className="ops-other-menu" ref={otherMenuRef}>
              <summary
                className={
                  visibleOtherSections.includes(activeSection) ? "ops-other-trigger active" : "ops-other-trigger"
                }
              >
                Other
              </summary>
              <div className="ops-other-dropdown">
                {SECTIONS.filter((section) => visibleOtherSections.includes(section.id)).map((section) => (
                  <button
                    key={section.id}
                    className={activeSection === section.id ? "active" : undefined}
                    onClick={() => navigateToSection(section.id)}
                    type="button"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </details>
          </nav>

      <div className="ops-topbar-right">
            <details className="ops-notification-menu" ref={notificationMenuRef}>
              <summary className="ops-notification-trigger">
                <span className="ops-notification-icon" aria-hidden="true">
                  🔔
                </span>
                {unreadNotificationCount > 0 ? (
                  <span className="ops-notification-badge">{unreadNotificationCount}</span>
                ) : null}
              </summary>
              <div className="ops-notification-dropdown">
                <div className="ops-notification-head">
                  <strong>Notifications</strong>
                  <button
                    className="ops-mini"
                    onClick={() => void handleMarkAllNotificationsRead()}
                    type="button"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="ops-notification-list">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        className={`ops-notification-item ${notification.readAt ? "read" : "unread"}`}
                        key={notification.notificationId}
                        onClick={() => void handleNotificationClick(notification)}
                        type="button"
                      >
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <span className="ops-meta">{formatDateTime(notification.createdAt)}</span>
                      </button>
                    ))
                  ) : (
                    <p className="ops-meta">No notifications yet.</p>
                  )}
                </div>
              </div>
            </details>

            <details className="ops-context-menu">
              <summary className="ops-context-trigger">Context</summary>
              <div className="ops-context-dropdown">
                <label>
                  Bank tenant
                  <select disabled value={session.bankTenantId}>
                    {selectedBank ? (
                      <option value={selectedBank.tenantId}>
                        {selectedBank.name} ({selectedBank.tenantId})
                      </option>
                    ) : (
                      <option value={session.bankTenantId}>{session.bankTenantId}</option>
                    )}
                  </select>
                </label>

                <label>
                  Corporate tenant
                  <select disabled value={session.corporateTenantId}>
                    {selectedTenant ? (
                      <option value={selectedTenant.tenantId}>
                        {selectedTenant.name} ({selectedTenant.tenantId})
                      </option>
                    ) : (
                      <option value={session.corporateTenantId}>{session.corporateTenantId}</option>
                    )}
                  </select>
                </label>

                <label>
                  Corporate
                  <select
                    onChange={(event) => setSelectedCorporateId(event.target.value)}
                    value={selectedCorporateId}
                  >
                    {corporates.map((corporate) => (
                      <option key={corporate.corporateId} value={corporate.corporateId}>
                        {corporate.name} ({corporate.corporateId})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            <div className="ops-avatar-menu" tabIndex={0}>
              <button className="ops-avatar-button" type="button" aria-label="Open profile details">
                {avatarInitials}
              </button>
              <div className="ops-avatar-card">
                <strong>{session.displayName}</strong>
                <p className="ops-meta">@{session.username}</p>
                <p className="ops-meta">Role: {session.role}</p>
                <p className="ops-meta">
                  Tenant: {selectedTenant?.name ?? session.corporateTenantId}
                </p>
                <button className="ops-button ops-logout" onClick={handleLogout} type="button">
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {notice ? (
          <section className={`ops-banner ops-banner-${notice.tone}`}>
            <p>{notice.text}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {notice.tone === "error" ? (
                <button
                  className="ops-banner-close"
                  onClick={() => void copyText(notice.text)}
                  type="button"
                >
                  Copy
                </button>
              ) : null}
              <button
                className="ops-banner-close"
                onClick={() => setNotice(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        {!mounted ? (
          <section className="ops-page active" style={{ display: "block" }}>
            <style>{`
              @keyframes ops-pulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
              }
              .ops-skeleton-pulse {
                animation: ops-pulse 1.5s ease-in-out infinite;
              }
            `}</style>
            <div className="ops-stripe-section-title ops-skeleton-pulse">
              <span style={{ display: "inline-block", width: "120px", height: "20px", background: "var(--border)", borderRadius: "4px" }}></span>
            </div>
            <div className="ops-stripe-metrics-grid ops-skeleton-pulse">
              <div className="ops-stripe-metric-card" style={{ background: "var(--surface-subtle)" }}>
                <div style={{ width: "80px", height: "12px", background: "var(--border)", borderRadius: "2px", marginBottom: "8px" }} />
                <div style={{ width: "140px", height: "28px", background: "var(--border)", borderRadius: "4px" }} />
              </div>
              <div className="ops-stripe-metric-card" style={{ background: "var(--surface-subtle)" }}>
                <div style={{ width: "80px", height: "12px", background: "var(--border)", borderRadius: "2px", marginBottom: "8px" }} />
                <div style={{ width: "140px", height: "28px", background: "var(--border)", borderRadius: "4px" }} />
              </div>
              <div className="ops-stripe-metric-card" style={{ background: "var(--surface-subtle)" }}>
                <div style={{ width: "80px", height: "12px", background: "var(--border)", borderRadius: "2px", marginBottom: "8px" }} />
                <div style={{ width: "140px", height: "28px", background: "var(--border)", borderRadius: "4px" }} />
              </div>
            </div>
            <div className="ops-skeleton-pulse" style={{ width: "100%", height: "260px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "8px" }} />
          </section>
        ) : activeSection === "home" ? (
          <section className="ops-page active" style={{ display: "block" }}>
            <div className="ops-stripe-section-title">
              <span>Overview</span>
              <select 
                className="ops-stripe-filter-select"
                value={dashboardDateRange}
                onChange={(e) => setDashboardDateRange(e.target.value)}
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>

            <div className="ops-stripe-metrics-grid">
              <div className="ops-stripe-metric-card">
                <div className="ops-stripe-metric-label">Total Volume</div>
                <div className="ops-stripe-metric-value">
                  INR {formatAmount(dashboardVolume)}
                </div>
              </div>
              
              <div className="ops-stripe-metric-card">
                <div className="ops-stripe-metric-label">Pending Approvals</div>
                <div className="ops-stripe-metric-value">
                  {approvalEntries.length}
                </div>
              </div>

              <div className="ops-stripe-metric-card">
                <div className="ops-stripe-metric-label">Active Beneficiaries</div>
                <div className="ops-stripe-metric-value">
                  {approvedBeneficiaries.length}
                </div>
              </div>

              <div className="ops-stripe-metric-card">
                <div className="ops-stripe-metric-label">Total Transactions</div>
                <div className="ops-stripe-metric-value">
                  {dashboardTransactions.length}
                </div>
              </div>
            </div>

            <div className="ops-stripe-section-title" style={{ marginTop: "32px" }}>
              <span>Recent Activity</span>
              <button
                className="ops-button secondary ops-mini"
                onClick={() => navigateToSection("transactions")}
                type="button"
              >
                View all
              </button>
            </div>

            <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end" }}>
              <label style={{ minWidth: "240px", flex: 1 }}>
                Search activity
                <input
                  value={homeSearch}
                  onChange={(e) => setHomeSearch(e.target.value)}
                  placeholder="Search by reference, beneficiary"
                />
              </label>
            </div>

            <div className="ops-stripe-table-container">
              <table className="ops-stripe-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Beneficiary</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHomeTransactions.slice(0, 8).map((transaction) => {
                    const beneficiaryName =
                      transaction.primaryBeneficiaryName ??
                      beneficiaries.find(
                        (b) => b.beneficiaryId === transaction.primaryBeneficiaryId
                      )?.name ??
                      "Unknown";

                    return (
                      <tr key={transaction.batchId}>
                        <td>
                          <strong>{transaction.title}</strong>
                        </td>
                        <td>{beneficiaryName}</td>
                        <td>INR {formatAmount(transaction.totalAmount.value)}</td>
                        <td>{formatDateTime(transaction.createdAt).split(' ')[0]}</td>
                        <td>
                          <span className={`ops-stripe-badge ${transaction.state}`}>
                            {humanize(transaction.state)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHomeTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#647382" }}>
                        {dashboardTransactions.length > 0 ? "No transactions match the search filter." : "No transactions found for this period."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeSection === "transactions" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Transactions</h3>
                </div>
                <div className="ops-actions">
                  {isTransactionMaker ? (
                    <>
                      <button
                        className="ops-button secondary"
                        onClick={() => setShowTransactionBulkUpload((current) => !current)}
                        type="button"
                      >
                        {showTransactionBulkUpload ? "Close upload" : "Bulk upload"}
                      </button>
                      <button
                        className="ops-button primary"
                        onClick={() => setShowTransactionCreate((current) => !current)}
                        type="button"
                      >
                        {showTransactionCreate ? "Close form" : "Create transaction"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {showTransactionBulkUpload && isTransactionMaker ? (
                <div className="ops-drawer">
                  <form className="ops-form" onSubmit={handleBulkTransactionUpload}>
                    <div className="ops-fields one">
                      <label>
                        Upload Excel file
                        <input accept=".xlsx,.xls" name="file" required type="file" />
                      </label>
                    </div>
                    <p className="ops-meta">
                      Required columns: Package Code, Transaction Reference, Beneficiary ID, Amount, Tag, Remark
                    </p>
                    <div className="ops-actions">
                      <a
                        className="ops-button secondary ops-link-button"
                        href={`/api/payouts/bulk-upload/template${
                          selectedTransactionPackageCode
                            ? `?packageCode=${encodeURIComponent(selectedTransactionPackageCode)}`
                            : ""
                        }${
                          selectedTransactionPaymentMethodCode
                            ? `${selectedTransactionPackageCode ? "&" : "?"}paymentMethodCode=${encodeURIComponent(selectedTransactionPaymentMethodCode)}`
                            : ""
                        }${
                          selectedTransactionDebitAccount?.accountNumber
                            ? `${selectedTransactionPackageCode || selectedTransactionPaymentMethodCode ? "&" : "?"}debitAccountNumber=${encodeURIComponent(
                                selectedTransactionDebitAccount.accountNumber
                              )}`
                            : ""
                        }`}
                      >
                        Download template
                      </a>
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy ? "Uploading..." : "Upload and create"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {showTransactionCreate && isTransactionMaker ? (
                <div className="ops-drawer">
                  <form className="ops-form" onSubmit={handleTransactionSubmit}>
                    <div className="ops-fields three">
                      <label>
                        Package
                        <select
                          name="packageCode"
                          required
                          value={selectedTransactionPackageCode}
                          onChange={(event) => {
                            setSelectedTransactionPackageCode(event.target.value);
                            setSelectedTransactionDebitAccountId("");
                            setSelectedTransactionPaymentMethodCode("");
                          }}
                        >
                          {transactionPackageOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Debit Account
                        <select
                          name="debitAccountId"
                          required
                          value={selectedTransactionDebitAccountId}
                          onChange={(event) =>
                            setSelectedTransactionDebitAccountId(event.target.value)
                          }
                        >
                          <option value="">Select debit account</option>
                          {selectedTransactionDebitAccounts.map((account) => (
                            <option key={account.debitAccountId} value={account.debitAccountId}>
                              {account.accountName} ({account.accountNumber})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Payment Method
                        <select
                          name="paymentMethodCode"
                          required
                          value={selectedTransactionPaymentMethodCode}
                          onChange={(event) =>
                            setSelectedTransactionPaymentMethodCode(event.target.value)
                          }
                        >
                          <option value="">Select payment method</option>
                          {selectedTransactionPaymentMethods.map((methodCode) => (
                            <option key={methodCode} value={methodCode}>
                              {methodCode}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="ops-fields two">
                      <label>
                        Transaction Reference
                        <input
                          name="transactionReference"
                          placeholder="INV-2026-000143"
                          required
                        />
                      </label>
                      <label>
                        Beneficiary Name
                        <select name="beneficiaryId" required>
                          {packageAwareBeneficiaries.map((beneficiary) => (
                            <option key={beneficiary.beneficiaryId} value={beneficiary.beneficiaryId}>
                              {beneficiary.name} ({beneficiary.beneficiaryId})
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="ops-fields three">
                      <label>
                        Amount (INR)
                        <input
                          inputMode="decimal"
                          min="1"
                          name="amount"
                          placeholder="1000.00"
                          step="0.01"
                          type="number"
                          required
                        />
                      </label>
                      <label>
                        Tag
                        <input name="tag" placeholder="salary, vendor, reimbursements" />
                      </label>
                      <label>
                        Remark
                        <input name="remark" placeholder="Optional internal note" />
                      </label>
                    </div>

                    <div className="ops-actions">
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy ? "Submitting..." : "Create and submit"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ marginTop: "12px", display: "flex", alignItems: "end", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: "6px" }}>Date Range</label>
                  <button
                    type="button"
                    className="ops-button secondary"
                    onClick={() => setShowTransactionDatePicker((current) => !current)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "200px" }}
                  >
                    <span style={{ opacity: 0.7 }}>
                      {transactionDatePreset === "all"
                        ? "All time"
                        : transactionDatePreset === "today"
                          ? "Today"
                          : transactionDatePreset === "yesterday"
                            ? "Yesterday"
                            : transactionDatePreset === "week"
                              ? "This week"
                              : transactionDatePreset === "month"
                                ? "This month"
                                : "Custom"}
                    </span>
                  </button>

                  {showTransactionDatePicker ? (
                    <>
                      <div
                        onClick={() => setShowTransactionDatePicker(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 39,
                          background: "transparent"
                        }}
                      />
                      <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 10px)",
                          left: 0,
                          width: "440px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "18px",
                          boxShadow: "0 24px 56px rgba(15, 23, 42, 0.16)",
                          padding: "16px",
                          zIndex: 40
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "14px" }}>
                          <div style={{ display: "grid", gap: "8px" }}>
                            {[
                              ["all", "All time"],
                              ["today", "Today"],
                              ["yesterday", "Yesterday"],
                              ["week", "This week"],
                              ["month", "This month"],
                              ["custom", "Custom"]
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className="ops-button secondary"
                                onClick={() => setTransactionDatePreset(value)}
                                style={{
                                  justifyContent: "flex-start",
                                  width: "100%",
                                  background: transactionDatePreset === value ? "var(--accent-soft)" : "var(--surface)"
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: "grid", gap: "12px", alignContent: "start" }}>
                            {transactionDatePreset === "custom" ? (
                              <>
                                <label>
                                  Start date
                                  <input
                                    onChange={(event) => setTransactionCustomStart(event.target.value)}
                                    type="date"
                                    value={transactionCustomStart}
                                  />
                                </label>
                                <label>
                                  End date
                                  <input
                                    onChange={(event) => setTransactionCustomEnd(event.target.value)}
                                    type="date"
                                    value={transactionCustomEnd}
                                  />
                                </label>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                  <button
                                    type="button"
                                    className="ops-button secondary"
                                    onClick={() => setShowTransactionDatePicker(false)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="ops-button primary"
                                  onClick={() => setShowTransactionDatePicker(false)}
                                >
                                  Set date
                                </button>
                              </div>
                            </>
                            ) : (
                              <p className="ops-meta" style={{ margin: 0 }}>
                                Choose a quick range or switch to custom to set start and end dates.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <label style={{ minWidth: "180px", flex: 1 }}>
                  Status
                  <select
                    onChange={(event) => setTransactionStateFilter(event.target.value)}
                    value={transactionStateFilter}
                  >
                    <option value="">All states</option>
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending approval</option>
                    <option value="partially_approved">Partially approved</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="sent_to_bank">Sent to bank</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label style={{ minWidth: "220px", flex: 1.2 }}>
                  Search anything
                  <input
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder="Search by reference, beneficiary, amount"
                    value={transactionSearch}
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Transaction Reference</th>
                      <th>Beneficiary</th>
                      <th>Amount</th>
                      <th>Package</th>
                      <th>Payment Method</th>
                      <th>Tag</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionRows.map((transaction) => {
                      const beneficiaryName =
                        transaction.primaryBeneficiaryName ??
                        beneficiaries.find(
                          (beneficiary) =>
                            beneficiary.beneficiaryId === transaction.primaryBeneficiaryId
                        )?.name ??
                        transaction.primaryBeneficiaryId ??
                        "Unknown beneficiary";

                      const packageLabel = transaction.packageCode ?? "No package";
                      const paymentMethodLabel = transaction.paymentMethodCode ?? "Not captured";

                      return (
                        <tr
                          key={transaction.batchId}
                          onClick={() => setActiveTimelineId(transaction.batchId)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <strong>{transaction.title}</strong>
                            <br />
                            <span className="ops-meta">{transaction.remark ?? "No remark"}</span>
                          </td>
                          <td>{beneficiaryName}</td>
                          <td>INR {formatAmount(transaction.totalAmount.value)}</td>
                          <td>{packageLabel}</td>
                          <td>{paymentMethodLabel}</td>
                          <td>{transaction.tag ?? "Not tagged"}</td>
                          <td>
                            <span className={`ops-status ${transaction.state}`}>
                              {humanize(transaction.state)}
                            </span>
                          </td>
                          <td>{formatDateTime(transaction.createdAt)}</td>
                        </tr>
                      );
                    })}
                    {transactionRows.length === 0 ? (
                      <tr>
                        <td className="ops-empty" colSpan={8}>
                          {busy ? "Loading transactions..." : "No transactions match the current filters."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "file-uploads" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>File Uploads</h3>

                </div>
                <div className="ops-actions">
                  {isTransactionMaker ? (
                    <button
                      className="ops-button primary"
                      onClick={() => setShowTransactionBulkUpload((current) => !current)}
                      type="button"
                    >
                      {showTransactionBulkUpload ? "Close upload" : "Upload file"}
                    </button>
                  ) : null}
                </div>
              </div>

              {showTransactionBulkUpload && isTransactionMaker ? (
                <div className="ops-drawer">
                  <form className="ops-form" onSubmit={handleBulkTransactionUpload}>
                    <div className="ops-fields one">
                      <label>
                        Upload Excel file
                        <input accept=".xlsx,.xls" name="file" required type="file" />
                      </label>
                    </div>
                    <p className="ops-meta">
                      Required columns: Transaction Reference, Beneficiary Name, Amount, Tag, Remark
                    </p>
                    <div className="ops-actions">
                      <a
                        className="ops-button secondary ops-link-button"
                        href="/api/payouts/bulk-upload/template"
                      >
                        Download template
                      </a>
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy ? "Uploading..." : "Upload and create"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0 24px" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={fileUploadStatusFilter} onChange={(e) => setFileUploadStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processed">Processed</option>
                    <option value="failed">Failed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label style={{ minWidth: "240px", flex: 1.5 }}>
                  Search uploads
                  <input
                    value={fileUploadSearch}
                    onChange={(e) => setFileUploadSearch(e.target.value)}
                    placeholder="Search by file name, uploader"
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Uploaded Time</th>
                      <th>Uploaded By</th>
                      <th>Status</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFileUploads.length > 0 ? (
                      filteredFileUploads.map((fileUpload) => (
                        <tr key={fileUpload.uploadId}>
                          <td>{fileUpload.fileName}</td>
                          <td>{formatDateTime(fileUpload.uploadedAt)}</td>
                          <td>{fileUpload.uploadedByName ?? fileUpload.uploadedByUserId}</td>
                          <td>
                            <span className={`ops-status ${fileUpload.status}`}>
                              {humanize(fileUpload.status)}
                            </span>
                          </td>
                          <td>{fileUpload.remark ?? "No remarks"}</td>
                        </tr>
                      ))
                    ) : loading || busy ? (
                      <tr>
                        <td className="ops-empty-row" colSpan={5}>
                          Loading file uploads...
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="ops-empty-row" colSpan={5}>
                          {fileUploads.length > 0 ? "No file uploads match the current filters." : "No files uploaded yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "beneficiaries" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Beneficiaries</h3>

                </div>
                <div className="ops-actions">
                  {isBeneficiaryMaker ? (
                    <button
                      className="ops-button primary"
                      onClick={() => {
                        if (showBeneficiaryCreate) {
                          setShowBeneficiaryCreate(false);
                          setEditingBeneficiaryId(null);
                          setBeneficiaryPackageCodes([]);
                        } else {
                          setEditingBeneficiaryId(null);
                          setBeneficiaryPackageCodes([]);
                          setShowBeneficiaryCreate(true);
                        }
                      }}
                      type="button"
                    >
                      {showBeneficiaryCreate ? (editingBeneficiary ? "Close edit" : "Close form") : "Create beneficiary"}
                    </button>
                  ) : null}
                </div>
              </div>

              {showBeneficiaryCreate && isBeneficiaryMaker ? (
                <div className="ops-drawer">
                  <form
                    className="ops-form"
                    key={editingBeneficiary?.beneficiaryId ?? "beneficiary-create"}
                    onSubmit={handleBeneficiarySubmit}
                  >
                    <div className="ops-fields two">
                      <label>
                        Bene ID
                        <input
                          defaultValue={editingBeneficiary?.beneficiaryId ?? ""}
                          name="beneficiaryId"
                          placeholder="KUMAR123"
                          required
                          disabled={Boolean(editingBeneficiary)}
                        />
                      </label>
                      <label>
                        Bene Name
                        <input
                          defaultValue={editingBeneficiary?.name ?? ""}
                          name="name"
                          placeholder="Orbit Vendor Services"
                          required
                        />
                      </label>
                    </div>

                    <div className="ops-fields three">
                      <label>
                        Bene Bank Account Number
                        <input
                          defaultValue={editingBeneficiary?.accountNumber ?? ""}
                          name="accountNumber"
                          placeholder="409876543210"
                          required
                        />
                      </label>
                      <label>
                        Bene IFSC Code
                        <input
                          defaultValue={editingBeneficiary?.ifsc ?? ""}
                          name="ifsc"
                          placeholder="HDFC0001234"
                          required
                        />
                      </label>
                      <label>
                        Bene Phone Number
                        <input
                          defaultValue={editingBeneficiary?.phoneNumber ?? ""}
                          name="phoneNumber"
                          placeholder="+91 9876543210"
                          required
                        />
                      </label>
                    </div>

                    <div className="ops-fields one">
                      <label>
                        Packages
                        <CompactMultiDropdown
                          label="beneficiary packages"
                          options={subscriptions
                            .filter((subscription) => subscription.status === "active")
                            .map((subscription) => ({
                              value: subscription.packageCode,
                              label: `${subscription.displayName} (${subscription.packageCode})`
                            }))}
                          values={beneficiaryPackageCodes}
                          onChange={setBeneficiaryPackageCodes}
                          placeholder="Attach packages"
                        />
                      </label>
                    </div>

                    <div className="ops-fields one">
                      <label>
                        Tags
                        <input name="tags" placeholder="Optional, comma separated" />
                      </label>
                    </div>

                    <div className="ops-actions">
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy
                          ? "Saving..."
                          : editingBeneficiary
                            ? "Save beneficiary"
                            : "Create beneficiary"}
                      </button>
                      {editingBeneficiary ? (
                        <button
                          className="ops-button"
                          disabled={busy}
                          type="button"
                          onClick={() => {
                            setShowBeneficiaryCreate(false);
                            setEditingBeneficiaryId(null);
                            setBeneficiaryPackageCodes([]);
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="ops-button"
                          disabled={busy}
                          type="button"
                          onClick={() => {
                            setBeneficiaryPackageCodes([]);
                            setShowBeneficiaryCreate(false);
                          }}
                          >
                          Reset
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : null}

              {beneficiaryActionItem && beneficiaryActionMenuOpen ? (
                <div className="ops-row-action-modal" onMouseDown={() => setBeneficiaryActionMenuOpen(false)}>
                  <div className="ops-row-action-card" onMouseDown={(event) => event.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                      <div>
                        <h4 className="ops-row-action-title">Beneficiary actions</h4>
                        <p className="ops-row-action-subtitle">
                          {beneficiaryActionItem.beneficiaryId} · {beneficiaryActionItem.name}
                        </p>
                      </div>
                      <button type="button" className="ops-mini" onClick={() => setBeneficiaryActionMenuOpen(false)}>
                        Close
                      </button>
                    </div>
                    <div className="ops-row-action-list">
                      <button
                        className="ops-mini"
                        type="button"
                        onClick={() => beginEditBeneficiary(beneficiaryActionItem)}
                        style={{ width: "100%", textAlign: "left" }}
                      >
                        Edit
                      </button>
                      <button
                        className="ops-mini"
                        type="button"
                        onClick={() =>
                          void updateBeneficiaryStatusFromMenu(
                            beneficiaryActionItem.status === "active" ? "deactivate" : "activate"
                          )
                        }
                        style={{ width: "100%", textAlign: "left" }}
                      >
                        {beneficiaryActionItem.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="ops-toolbar ops-fields three">
                <label>
                  Search
                  <input
                    onChange={(event) => setBeneficiarySearch(event.target.value)}
                    placeholder="Search by bene ID, name, or account"
                    value={beneficiarySearch}
                  />
                </label>
                <label>
                  Status
                  <select
                    onChange={(event) => setBeneficiaryStatusFilter(event.target.value)}
                    value={beneficiaryStatusFilter}
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Bene ID</th>
                      <th>Bene Name</th>
                      <th>Last Updated At</th>
                      <th>Account Number</th>
                      <th>Bank Name</th>
                      <th>IFSC Code</th>
                      <th>Packages</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiaryRows.map((beneficiary) => (
                      <tr key={beneficiary.beneficiaryId}>
                        <td>{beneficiary.beneficiaryId}</td>
                        <td>
                          <strong>{beneficiary.name}</strong>
                          <br />
                          <span className="ops-meta">{beneficiary.phoneNumber ?? "No phone"}</span>
                        </td>
                        <td>{formatDateTime(beneficiary.lastUpdatedAt)}</td>
                        <td>{maskAccountNumber(beneficiary.accountNumber)}</td>
                        <td>{beneficiary.bankName}</td>
                        <td>{beneficiary.ifsc}</td>
                        <td>
                          {beneficiary.assignedPackages.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {beneficiary.assignedPackages.map((item) => (
                                <span
                                  key={item.packageId}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "999px",
                                    background: "var(--accent-soft)",
                                    color: "var(--accent)",
                                    fontSize: "12px",
                                    fontWeight: 600
                                  }}
                                >
                                  {item.packageCode}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="ops-meta">No packages</span>
                          )}
                        </td>
                        <td>
                          <span className={`ops-status ${beneficiary.status}`}>
                            {humanize(beneficiary.status)}
                          </span>
                          <br />
                          <span className={`ops-status ${beneficiary.approvalState}`}>
                            {humanize(beneficiary.approvalState)}
                          </span>
                        </td>
                        <td>
                          {isBeneficiaryMaker ? (
                            <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="ops-kebab"
                                onClick={() => openBeneficiaryActions(beneficiary)}
                                type="button"
                              >
                                ⋮
                              </button>
                            </div>
                          ) : (
                            <span className="ops-meta">
                              {beneficiary.approvalState === "pending_approval"
                                ? "Waiting for checker"
                                : beneficiary.approvalState === "rejected"
                                  ? "Rejected"
                                  : "Maker only"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {beneficiaryRows.length === 0 ? (
                      <tr>
                        <td className="ops-empty" colSpan={9}>
                          {busy ? "Loading beneficiaries..." : "No beneficiaries match the current filters."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "approvals" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Checker workbench</h3>
                </div>
              </div>

              <div className="ops-stack">
                <div className="ops-approval-summary">
                  {[
                    {
                      filter: "transaction" as const,
                      label: "Payments",
                      count: paymentApprovalEntries.length
                    },
                    {
                      filter: "beneficiary" as const,
                      label: "Beneficiaries",
                      count: beneficiaryApprovalEntries.length
                    },
                    {
                      filter: "role" as const,
                      label: "Roles",
                      count: roleApprovalEntries.length
                    },
                    {
                      filter: "user" as const,
                      label: "Users",
                      count: userApprovalEntries.length
                    }
                  ].map((item) => (
                    <button
                      key={item.filter}
                      className={`ops-summary-tile ${
                        approvalSectionFilter === item.filter ? "ops-summary-tile-active" : ""
                      }`}
                      onClick={() => jumpToApprovalSection(item.filter)}
                      type="button"
                    >
                      <span className="ops-kicker">{item.label}</span>
                      <strong>{item.count}</strong>
                      <span className="ops-meta">Pending approvals</span>
                    </button>
                  ))}
                </div>

                <div className="ops-actions ops-filter-tabs">
                  {[
                    { filter: "all" as const, label: "All queues" },
                    { filter: "transaction" as const, label: "Payments" },
                    { filter: "beneficiary" as const, label: "Beneficiaries" },
                    { filter: "role" as const, label: "Roles" },
                    { filter: "user" as const, label: "Users" }
                  ].map((item) => (
                    <button
                      key={item.filter}
                      className={`ops-mini ${
                        approvalSectionFilter === item.filter ? "ops-mini-active" : ""
                      }`}
                      onClick={() => jumpToApprovalSection(item.filter)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="ops-toolbar" style={{ display: "flex", alignItems: "end", gap: "12px", flexWrap: "wrap" }}>
                  <label style={{ minWidth: "240px", flex: 1.5, order: 2 }}>
                    Search approvals
                    <input
                      value={approvalSearch}
                      onChange={(e) => setApprovalSearch(e.target.value)}
                      placeholder="Search title, ID, creator..."
                    />
                  </label>
                  <div style={{ position: "relative", order: 1 }}>
                    <label style={{ display: "block", marginBottom: "6px" }}>Date Range</label>
                    <button
                      type="button"
                      className="ops-button secondary"
                      onClick={() => setShowApprovalDatePicker((current) => !current)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "200px" }}
                    >
                      <span style={{ opacity: 0.7 }}>
                        {approvalDatePreset === "all"
                          ? "All time"
                          : approvalDatePreset === "today"
                            ? "Today"
                            : approvalDatePreset === "yesterday"
                              ? "Yesterday"
                              : approvalDatePreset === "week"
                                ? "This week"
                                : approvalDatePreset === "month"
                                  ? "This month"
                                  : "Custom"}
                      </span>
                    </button>

                    {showApprovalDatePicker ? (
                      <>
                        <div
                          onClick={() => setShowApprovalDatePicker(false)}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 39,
                            background: "transparent"
                          }}
                        />
                        <div
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "calc(100% + 10px)",
                            left: 0,
                            width: "440px",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "18px",
                            boxShadow: "0 24px 56px rgba(15, 23, 42, 0.16)",
                            padding: "16px",
                            zIndex: 40
                          }}
                        >
                          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "14px" }}>
                            <div style={{ display: "grid", gap: "8px" }}>
                              {[
                                ["all", "All time"],
                                ["today", "Today"],
                                ["yesterday", "Yesterday"],
                                ["week", "This week"],
                                ["month", "This month"],
                                ["custom", "Custom"]
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className="ops-button secondary"
                                  onClick={() => setApprovalDatePreset(value)}
                                  style={{
                                    justifyContent: "flex-start",
                                    width: "100%",
                                    background: approvalDatePreset === value ? "var(--accent-soft)" : "var(--surface)"
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: "grid", gap: "12px", alignContent: "start" }}>
                              {approvalDatePreset === "custom" ? (
                                <>
                                  <label>
                                    Start date
                                    <input
                                      onChange={(event) => setApprovalCustomStart(event.target.value)}
                                      type="date"
                                      value={approvalCustomStart}
                                    />
                                  </label>
                                  <label>
                                    End date
                                    <input
                                      onChange={(event) => setApprovalCustomEnd(event.target.value)}
                                      type="date"
                                      value={approvalCustomEnd}
                                    />
                                  </label>
                                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                    <button
                                      type="button"
                                      className="ops-button secondary"
                                      onClick={() => setShowApprovalDatePicker(false)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="ops-button primary"
                                      onClick={() => setShowApprovalDatePicker(false)}
                                    >
                                      Set date
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <p className="ops-meta" style={{ margin: 0 }}>
                                  Choose a quick range or switch to custom to set start and end dates.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {(approvalSectionFilter === "all" || approvalSectionFilter === "transaction") ? (
                <div className="ops-approval-block" ref={paymentApprovalsRef}>
                  <div className="ops-approval-head">
                    <div>
                      <h4>Payment approvals</h4>

                    </div>
                    <span className="ops-status pending_approval">
                      {paymentApprovalEntries.length} pending
                    </span>
                  </div>
                  <div className="ops-table-shell">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>Transaction Reference</th>
                          <th>Txn UUID</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentApprovalEntries.length > 0 ? (
                          paymentApprovalEntries.map((entry) => (
                            <tr
                              className="ops-clickable-row"
                              key={`transaction:${entry.id}`}
                              onClick={() => {
                                setSelectedApprovalKey(`transaction:${entry.id}`);
                                setApprovalComment("");
                                void loadTransactionDetail(entry.id);
                              }}
                            >
                              <td>{entry.title}</td>
                              <td>{entry.id}</td>
                              <td>{entry.meta.split("|")[1]?.trim() ?? entry.meta}</td>
                              <td>
                                <span className={`ops-status ${entry.status}`}>
                                  {humanize(entry.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="ops-empty-row" colSpan={4}>
                              No payment approvals pending.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                ) : null}

                {(approvalSectionFilter === "all" || approvalSectionFilter === "beneficiary") ? (
                <div className="ops-approval-block" ref={beneficiaryApprovalsRef}>
                  <div className="ops-approval-head">
                    <div>
                      <h4>Beneficiary approvals</h4>

                    </div>
                    <span className="ops-status pending_approval">
                      {beneficiaryApprovalEntries.length} pending
                    </span>
                  </div>
                  <div className="ops-table-shell">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>Bene Name</th>
                          <th>Bene ID</th>
                          <th>Bank</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beneficiaryApprovalEntries.length > 0 ? (
                          beneficiaryApprovalEntries.map((entry) => (
                            <tr
                              className="ops-clickable-row"
                              key={`beneficiary:${entry.id}`}
                              onClick={() => {
                                setSelectedApprovalKey(`beneficiary:${entry.id}`);
                                setApprovalComment("");
                              }}
                            >
                              <td>{entry.title}</td>
                              <td>{entry.id}</td>
                              <td>{entry.meta.split("|")[1]?.trim() ?? entry.meta}</td>
                              <td>
                                <span className={`ops-status ${entry.status}`}>
                                  {humanize(entry.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="ops-empty-row" colSpan={4}>
                              No beneficiary approvals pending.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                ) : null}

                <div className="ops-grid">
                  {(approvalSectionFilter === "all" || approvalSectionFilter === "role") ? (
                  <div className="ops-approval-block" ref={roleApprovalsRef}>
                    <div className="ops-approval-head">
                      <div>
                        <h4>Role approvals</h4>

                      </div>
                      <span className="ops-status pending_approval">
                        {roleApprovalEntries.length} pending
                      </span>
                    </div>
                    <div className="ops-table-shell">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>Role</th>
                            <th>Role ID</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roleApprovalEntries.length > 0 ? (
                            roleApprovalEntries.map((entry) => (
                              <tr
                                className="ops-clickable-row"
                                key={`role:${entry.id}`}
                                onClick={() => {
                                  setSelectedApprovalKey(`role:${entry.id}`);
                                  setApprovalComment("");
                                }}
                              >
                                <td>{entry.title}</td>
                                <td>{entry.id}</td>
                                <td>
                                  <span className={`ops-status ${entry.status}`}>
                                    {humanize(entry.status)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="ops-empty-row" colSpan={3}>
                                No role approvals pending.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  ) : null}

                  {(approvalSectionFilter === "all" || approvalSectionFilter === "user") ? (
                  <div className="ops-approval-block" ref={userApprovalsRef}>
                    <div className="ops-approval-head">
                      <div>
                        <h4>User approvals</h4>

                      </div>
                      <span className="ops-status pending_approval">
                        {userApprovalEntries.length} pending
                      </span>
                    </div>
                    <div className="ops-table-shell">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Username</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userApprovalEntries.length > 0 ? (
                            userApprovalEntries.map((entry) => (
                              <tr
                                className="ops-clickable-row"
                                key={`user:${entry.id}`}
                                onClick={() => {
                                  setSelectedApprovalKey(`user:${entry.id}`);
                                  setApprovalComment("");
                                }}
                              >
                                <td>{entry.title}</td>
                                <td>{entry.meta.split("|")[0]?.trim() ?? entry.meta}</td>
                                <td>
                                  <span className={`ops-status ${entry.status}`}>
                                    {humanize(entry.status)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="ops-empty-row" colSpan={3}>
                                No user approvals pending.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  ) : null}
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "approval-matrices" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Approval Matrix</h3>
                </div>
                {isRoleMaker ? (
                  <button
                    className="ops-button primary"
                    onClick={() => setShowApprovalMatrixCreate((current) => !current)}
                    type="button"
                  >
                    {showApprovalMatrixCreate ? "Close form" : "Create matrix"}
                  </button>
                ) : null}
              </div>

              {showApprovalMatrixCreate && isRoleMaker ? (
                <div className="ops-drawer">
                  <form className="ops-form" onSubmit={handleApprovalMatrixSubmit}>
                    <div className="ops-fields two">
                      <label>
                        Matrix name
                        <input name="name" placeholder="Vendor payment standard matrix" required />
                      </label>
                      <label>
                        Package subscription
                        <select
                          name="subscriptionId"
                          required
                          value={approvalMatrixSubscriptionId}
                          onChange={(event) => setApprovalMatrixSubscriptionId(event.target.value)}
                        >
                          <option value="">Select package subscription</option>
                          {subscriptions
                            .filter((subscription) => subscription.status === "active")
                            .map((subscription) => (
                              <option key={subscription.subscriptionId} value={subscription.subscriptionId}>
                                {subscription.displayName} ({subscription.packageCode})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        From Amount
                        <input min="0" name="amountFrom" required step="0.01" type="number" />
                      </label>
                      <label>
                        To Amount
                        <input min="0" name="amountTo" required step="0.01" type="number" />
                      </label>
                    </div>

                    <div className="ops-fields two">
                      <label>
                        Number of Approval Level
                        <select defaultValue="1" name="approvalLevels" required>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>
                      <label>
                        Debit accounts
                        <CompactMultiDropdown
                          label="approval matrix debit accounts"
                          options={debitAccounts
                            .filter((account) => account.status === "active")
                            .map((account) => ({
                              value: account.debitAccountId,
                              label: `${account.accountName} (${account.accountNumber})`
                            }))}
                          values={approvalMatrixDebitAccountIds}
                          onChange={setApprovalMatrixDebitAccountIds}
                          placeholder="Select debit accounts"
                        />
                      </label>
                    </div>

                    <div className="ops-fields one">
                      <label>
                        Roles
                        <CompactMultiDropdown
                          label="approval matrix roles"
                          options={approvedTransactionCheckerRoles.map((role) => ({
                            value: role.name,
                            label: role.name
                          }))}
                          values={approvalMatrixRoleNames}
                          onChange={setApprovalMatrixRoleNames}
                          placeholder="Select roles"
                        />
                      </label>
                    </div>

                    <div className="ops-actions">
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy ? "Saving..." : "Create approval matrix"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0 24px" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={matrixStatusFilter} onChange={(e) => setMatrixStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactive</option>
                  </select>
                </label>
                <label style={{ minWidth: "240px", flex: 1.5 }}>
                  Search matrices
                  <input
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Search by matrix name, roles"
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>From Amount</th>
                      <th>To Amount</th>
                      <th>Number of Approval Level</th>
                      <th>Roles</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApprovalMatrices.map((matrix) => (
                      <tr key={matrix.matrixId}>
                        <td>{matrix.name}</td>
                        <td>INR {formatAmount(matrix.amountFrom)}</td>
                        <td>INR {formatAmount(matrix.amountTo)}</td>
                        <td>{matrix.approvalLevels}</td>
                        <td>{matrix.roles.join(", ") || "No roles"}</td>
                        <td>
                          <span className={`ops-status ${matrix.status}`}>
                            {humanize(matrix.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredApprovalMatrices.length === 0 ? (
                      <tr>
                        <td className="ops-empty" colSpan={6}>
                          {approvalMatrices.length > 0 ? "No approval matrices match the current filters." : "No approval matrices configured yet."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "roles" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Roles</h3>

                </div>
                {isRoleMaker ? (
                  <button
                    className="ops-button primary"
                    onClick={() => {
                      if (showRoleCreate) {
                        setShowRoleCreate(false);
                        setEditingRoleId(null);
                      } else {
                        setEditingRoleId(null);
                        setShowRoleCreate(true);
                      }
                    }}
                    type="button"
                  >
                    {showRoleCreate ? (editingRole ? "Close edit" : "Close form") : "Create role"}
                  </button>
                ) : null}
              </div>

              {showRoleCreate && isRoleMaker ? (
                <div className="ops-drawer">
                  <form
                    className="ops-form"
                    key={editingRole?.roleId ?? "role-create"}
                    onSubmit={handleRoleSubmit}
                  >
                    <div className="ops-fields three">
                      <label>
                        Role name
                        <input
                          defaultValue={editingRole?.name ?? ""}
                          name="name"
                          placeholder="Finance checker"
                          required
                        />
                      </label>
                      <label>
                        Status
                        <select defaultValue={editingRole?.status ?? "inactive"} name="status" required>
                          <option value="inactive">Inactive</option>
                          <option value="active">Active</option>
                        </select>
                      </label>
                      <label>
                        Description
                        <input
                          defaultValue={editingRole?.description ?? ""}
                          name="description"
                          placeholder="Optional role note"
                        />
                      </label>
                    </div>
                    <div className="ops-permission-grid">
                      {PERMISSION_GROUPS.map((group) => (
                        <section className="ops-permission-card" key={group.label}>
                          <h4>{group.label}</h4>
                          <div className="ops-permission-list">
                            {group.items.map((permission) => (
                              <label className="ops-permission-item" key={permission.value}>
                                <input
                                  name="permissions"
                                  type="checkbox"
                                  value={permission.value}
                                  defaultChecked={editingRole?.permissions.includes(permission.value) ?? false}
                                />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <div className="ops-actions">
                      <button className="ops-button primary" disabled={busy} type="submit">
                        {busy ? "Saving..." : editingRole ? "Save role" : "Create role"}
                      </button>
                      {editingRole ? (
                        <button
                          className="ops-button"
                          disabled={busy}
                          type="button"
                          onClick={() => {
                            setShowRoleCreate(false);
                            setEditingRoleId(null);
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          className="ops-button"
                          disabled={busy}
                          type="button"
                          onClick={() => setShowRoleCreate(false)}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0 24px" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={roleStatusFilter} onChange={(e) => setRoleStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactive</option>
                  </select>
                </label>
                <label style={{ minWidth: "240px", flex: 1.5 }}>
                  Search roles
                  <input
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    placeholder="Search by role name, ID, permissions"
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Role ID</th>
                      <th>Description</th>
                      <th>Permissions</th>
                      <th>Status</th>
                      <th>Approval</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.map((role) => (
                      <tr key={role.roleId}>
                        <td>{role.name}</td>
                        <td>{role.roleId}</td>
                        <td>{role.description ?? "No description"}</td>
                        <td>{role.permissions.join(", ") || "No permissions"}</td>
                        <td>
                          <span className={`ops-status ${role.status}`}>{humanize(role.status)}</span>
                        </td>
                        <td>
                          <span className={`ops-status ${role.approvalState}`}>
                            {humanize(role.approvalState)}
                          </span>
                        </td>
                        <td>
                          {isRoleMaker ? (
                            <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="ops-kebab"
                                onClick={() => setRoleActionItem((current) => (current?.roleId === role.roleId ? null : role))}
                                type="button"
                              >
                                ⋮
                              </button>
                            </div>
                          ) : (
                            <span className="ops-meta">Maker only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredRoles.length === 0 ? (
                      <tr>
                        <td className="ops-empty-row" colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                          {roles.length > 0 ? "No roles match the current filters." : "No roles configured yet."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {roleActionItem ? (
                <div className="ops-row-action-modal" onMouseDown={() => setRoleActionItem(null)}>
                  <div className="ops-row-action-card" onMouseDown={(event) => event.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                      <div>
                        <h4 className="ops-row-action-title">Role actions</h4>
                        <p className="ops-row-action-subtitle">
                          {roleActionItem.roleId} · {roleActionItem.name}
                        </p>
                      </div>
                      <button type="button" className="ops-mini" onClick={() => setRoleActionItem(null)}>
                        Close
                      </button>
                    </div>
                    <div className="ops-row-action-list">
                      <button type="button" className="ops-mini" style={{ width: "100%", textAlign: "left" }} onClick={() => beginEditRole(roleActionItem)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ops-mini"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() =>
                          void updateRoleStatus(
                            roleActionItem,
                            roleActionItem.status === "active" ? "inactive" : "active"
                          )
                        }
                      >
                        {roleActionItem.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </section>
        ) : null}

        {activeSection === "users" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Users</h3>

                </div>
                {isUserMaker ? (
                  <button
                    className="ops-button primary"
                    onClick={() => setShowUserCreate((current) => !current)}
                    type="button"
                  >
                    {showUserCreate ? "Close form" : "Create user"}
                  </button>
                ) : null}
              </div>

              {showUserCreate && isUserMaker ? (
                <div className="ops-drawer">
                  <form className="ops-form" onSubmit={handleUserSubmit}>
                    <div className="ops-fields three">
                      <label>
                        Display name
                        <input name="displayName" placeholder="GRV Maker 2" required />
                      </label>
                      <label>
                        Username
                        <input name="username" placeholder="grvmaker2" required />
                      </label>
                      <label>
                        Password
                        <input minLength={4} name="password" placeholder="9771" required />
                      </label>
                    </div>
                    <div className="ops-fields three">
                      <label>
                        Role
                        <select name="role" required>
                          {approvedRoles.map((role) => (
                            <option key={role.roleId} value={role.name}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select name="status" required>
                          <option value="inactive">Inactive</option>
                          <option value="active">Active</option>
                        </select>
                      </label>
                    </div>
                    {approvedRoles.length === 0 ? (
                      <p className="ops-meta">
                        Approve at least one role first so it can be assigned to users.
                      </p>
                    ) : null}
                    <div className="ops-actions">
                      <button
                        className="ops-button primary"
                        disabled={busy || approvedRoles.length === 0}
                        type="submit"
                      >
                        {busy ? "Saving..." : "Create user"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0 24px" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactive</option>
                  </select>
                </label>
                <label style={{ minWidth: "240px", flex: 1.5 }}>
                  Search users
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by display name, username"
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Approval</th>
                      <th>Corporate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userId}>
                        <td>{user.displayName}</td>
                        <td>{user.username}</td>
                        <td>{user.role}</td>
                        <td>
                          <span className={`ops-status ${user.status}`}>{humanize(user.status)}</span>
                        </td>
                        <td>
                          <span className={`ops-status ${user.approvalState}`}>
                            {humanize(user.approvalState)}
                          </span>
                        </td>
                        <td>{user.corporateId ?? "Parent tenant access"}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td className="ops-empty-row" colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                          {users.length > 0 ? "No users match the current filters." : "No users configured yet."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "devportal" && canViewDevPortal ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Developer portal</h3>

                </div>
                <div className="ops-actions">
                  <a
                    className="ops-button secondary ops-link-button"
                    href="/bank/dev-portal"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open full portal
                  </a>
                  <a
                    className="ops-button primary ops-link-button"
                    href="/bank/dev-portal/openapi/swagger-download"
                  >
                    Download Swagger
                  </a>
                </div>
              </div>

              <iframe
                className="ops-devportal-frame"
                src="/bank/dev-portal"
                title="Future Pay Developer Portal"
              />
            </section>
          </section>
        ) : null}

        {activeSection === "reports" ? (
          <section className="ops-page active">
            <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", marginBottom: "6px" }}>Date Range</label>
                <button
                  type="button"
                  className="ops-button secondary"
                  onClick={() => setShowReportDatePicker((current) => !current)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "200px" }}
                >
                  <span style={{ opacity: 0.7 }}>
                    {reportDatePreset === "all"
                      ? "All time"
                      : reportDatePreset === "today"
                        ? "Today"
                        : reportDatePreset === "yesterday"
                          ? "Yesterday"
                          : reportDatePreset === "week"
                            ? "This week"
                            : reportDatePreset === "month"
                              ? "This month"
                              : "Custom"}
                  </span>
                </button>

                {showReportDatePicker ? (
                  <>
                    <div
                      onClick={() => setShowReportDatePicker(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 39,
                        background: "transparent"
                      }}
                    />
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        left: 0,
                        width: "440px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "18px",
                        boxShadow: "0 24px 56px rgba(15, 23, 42, 0.16)",
                        padding: "16px",
                        zIndex: 40
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "14px" }}>
                        <div style={{ display: "grid", gap: "8px" }}>
                          {[
                            ["all", "All time"],
                            ["today", "Today"],
                            ["yesterday", "Yesterday"],
                            ["week", "This week"],
                            ["month", "This month"],
                            ["custom", "Custom"]
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              className="ops-button secondary"
                              onClick={() => setReportDatePreset(value)}
                              style={{
                                justifyContent: "flex-start",
                                width: "100%",
                                background: reportDatePreset === value ? "var(--accent-soft)" : "var(--surface)"
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "grid", gap: "12px", alignContent: "start" }}>
                          {reportDatePreset === "custom" ? (
                            <>
                              <label>
                                Start date
                                <input
                                  onChange={(event) => setReportCustomStart(event.target.value)}
                                  type="date"
                                  value={reportCustomStart}
                                />
                              </label>
                              <label>
                                End date
                                <input
                                  onChange={(event) => setReportCustomEnd(event.target.value)}
                                  type="date"
                                  value={reportCustomEnd}
                                />
                              </label>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                <button
                                  type="button"
                                  className="ops-button secondary"
                                  onClick={() => setShowReportDatePicker(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="ops-button primary"
                                  onClick={() => setShowReportDatePicker(false)}
                                >
                                  Set date
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="ops-meta" style={{ margin: 0 }}>
                              Choose a quick range or switch to custom to set start and end dates.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="ops-summary">
              <article className="ops-stat">
                <strong>{transactions.length}</strong>
                <span>Total transactions</span>
              </article>
              <article className="ops-stat">
                <strong>INR {formatAmount(reportMetrics.totalProcessedAmount)}</strong>
                <span>Approved and processed amount</span>
              </article>
              <article className="ops-stat">
                <strong>{reportMetrics.approvedBeneficiaryCount}</strong>
                <span>Approved active beneficiaries</span>
              </article>
              <article className="ops-stat">
                <strong>{reportMetrics.approvalPendingCount}</strong>
                <span>Pending approvals</span>
              </article>
            </div>

            <div className="ops-grid">
              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Transaction status mix</h3>
                    <p className="ops-meta">
                      Live distribution of transactions by current lifecycle state.
                    </p>
                  </div>
                </div>
                <div className="ops-stack">
                  {reportMetrics.transactionStatusRows.length > 0 ? (
                    reportMetrics.transactionStatusRows.map((row) => (
                      <div className="ops-report-row" key={row.state}>
                        <div className="ops-report-row-head">
                          <strong>{humanize(row.state)}</strong>
                          <span className="ops-meta">
                            {row.count} transactions · {row.share}%
                          </span>
                        </div>
                        <div className="ops-report-bar">
                          <span
                            className="ops-report-bar-fill"
                            style={{ width: `${row.share}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="ops-empty">No transaction activity yet.</p>
                  )}
                </div>
              </section>

              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Beneficiary category mix</h3>
                    <p className="ops-meta">
                      Where the current beneficiary base is concentrated.
                    </p>
                  </div>
                </div>
                <div className="ops-stack">
                  {reportMetrics.beneficiaryCategoryRows.length > 0 ? (
                    reportMetrics.beneficiaryCategoryRows.map((row) => (
                      <div className="ops-report-row" key={row.category}>
                        <div className="ops-report-row-head">
                          <strong>{row.category}</strong>
                          <span className="ops-meta">{row.count} beneficiaries</span>
                        </div>
                        <div className="ops-report-bar">
                          <span
                            className="ops-report-bar-fill"
                            style={{
                              width: `${Math.max(
                                12,
                                Math.round(
                                  (row.count /
                                    Math.max(
                                      reportMetrics.beneficiaryCategoryRows[0]?.count ?? 1,
                                      1
                                    )) *
                                    100
                                )
                              )}%`
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="ops-empty">No beneficiary categories available yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="ops-grid">
              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Bulk upload performance</h3>
                    <p className="ops-meta">
                      File upload outcomes and total rows processed so far.
                    </p>
                  </div>
                </div>
                <div className="ops-summary">
                  <article className="ops-stat">
                    <strong>{fileUploads.length}</strong>
                    <span>Total uploaded files</span>
                  </article>
                  <article className="ops-stat">
                    <strong>{reportMetrics.totalUploadedRows}</strong>
                    <span>Total rows processed</span>
                  </article>
                </div>
                <div className="ops-stack">
                  {reportMetrics.uploadStatusRows.length > 0 ? (
                    reportMetrics.uploadStatusRows.map((row) => (
                      <div className="ops-report-row-head" key={row.status}>
                        <strong>{humanize(row.status)}</strong>
                        <span className={`ops-status ${row.status}`}>
                          {row.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="ops-empty">No file uploads recorded yet.</p>
                  )}
                </div>
              </section>

              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Recent transactions</h3>
                  </div>
                </div>

                <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", padding: "0 24px" }}>
                  <label style={{ minWidth: "240px", flex: 1 }}>
                    Search recent transactions
                    <input
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Search by reference, batch ID"
                    />
                  </label>
                </div>

                <div className="ops-table-shell">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReportRecentTransactions.length > 0 ? (
                        filteredReportRecentTransactions.map((transaction) => (
                          <tr key={transaction.batchId}>
                            <td>
                              <strong>{transaction.title}</strong>
                              <br />
                              <span className="ops-meta">{transaction.batchId}</span>
                            </td>
                            <td>INR {formatAmount(transaction.totalAmount.value)}</td>
                            <td>
                              <span className={`ops-status ${transaction.state}`}>
                                {humanize(transaction.state)}
                              </span>
                            </td>
                            <td>{formatDateTime(transaction.createdAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="ops-empty-row" colSpan={4}>
                            {reportMetrics.recentTransactions.length > 0 ? "No recent transactions match the search filter." : "No recent transactions yet."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeSection === "audit" ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>{activeSectionLabel}</h3>
                </div>
              </div>

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0 24px" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Entity Type
                  <select value={auditEntityFilter} onChange={(e) => setAuditEntityFilter(e.target.value)}>
                    <option value="">All types</option>
                    <option value="user">User</option>
                    <option value="role">Role</option>
                  </select>
                </label>
                <label style={{ minWidth: "240px", flex: 1.5 }}>
                  Search audit logs
                  <input
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search by item name, actor role, remark"
                  />
                </label>
              </div>

              <div className="ops-table-shell">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Name</th>
                      <th>Action</th>
                      <th>When</th>
                      <th>Actor Role</th>
                      <th>State</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditEntries.length > 0 ? (
                      filteredAuditEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{capitalize(entry.entity)}</td>
                          <td>{entry.itemName}</td>
                          <td>{capitalize(entry.action)}</td>
                          <td>{formatDateTime(entry.happenedAt)}</td>
                          <td>{entry.actorRole ?? "System"}</td>
                          <td>
                            <span className={`ops-status ${entry.state}`}>
                              {humanize(entry.state)}
                            </span>
                          </td>
                          <td>{entry.remark ?? "No remarks"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="ops-empty-row" colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                          {setupAuditEntries.length > 0 ? "No audit logs match the current filters." : "No setup audit activity yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "packages" ? (
          <PackagesSection
            corporateTenantId={session.corporateTenantId}
            corporateId={selectedCorporateId}
            bankTenantId={session.bankTenantId}
            debitAccounts={debitAccounts}
          />
        ) : null}

        {activeSection === "debit-accounts" ? (
          <DebitAccountsSection
            debitAccounts={debitAccounts}
            subscriptions={subscriptions}
            canEdit={canEditSettings}
            session={session}
            selectedCorporateId={selectedCorporateId}
            onUpdate={async () => {
              if (session) {
                await refreshWorkspace(session, selectedCorporateId, { silent: true });
              }
            }}
          />
        ) : null}

        {activeSection === "settings" && canViewSettings ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-inline-links">
                <button
                  className={`ops-inline-link ${settingsTab === "general" ? "active" : ""}`}
                  onClick={() => setSettingsTab("general")}
                  type="button"
                >
                  General
                </button>
                <button
                  className={`ops-inline-link ${settingsTab === "packages" ? "active" : ""}`}
                  onClick={() => setSettingsTab("packages")}
                  type="button"
                >
                  Packages
                </button>
                <button
                  className={`ops-inline-link ${settingsTab === "debit-accounts" ? "active" : ""}`}
                  onClick={() => setSettingsTab("debit-accounts")}
                  type="button"
                >
                  Debit Accounts
                </button>
              </div>
            </section>

            {settingsTab === "general" ? (
            <form className="ops-form" onSubmit={handleSettingsSubmit}>
              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Corporate profile</h3>
                  </div>
                </div>

                <div className="ops-fields two">
                  <label>
                    Company display name
                    <input
                      defaultValue={settings?.companyDisplayName ?? selectedTenant?.name ?? ""}
                      disabled={!canEditSettings}
                      name="companyDisplayName"
                      required
                    />
                  </label>
                  <label>
                    Support email
                    <input
                      defaultValue={settings?.supportEmail ?? ""}
                      disabled={!canEditSettings}
                      name="supportEmail"
                      placeholder="support@futurepay.in"
                      type="email"
                    />
                  </label>
                </div>

                <div className="ops-fields two">
                  <label>
                    Support phone
                    <input
                      defaultValue={settings?.supportPhone ?? ""}
                      disabled={!canEditSettings}
                      name="supportPhone"
                      placeholder="+91 98765 43210"
                    />
                  </label>
                  <label>
                    Registered address
                    <input
                      defaultValue={settings?.registeredAddress ?? ""}
                      disabled={!canEditSettings}
                      name="registeredAddress"
                      placeholder="Corporate registered address"
                    />
                  </label>
                </div>
              </section>

              <section className="ops-panel">
                <div className="ops-panel-head">
                  <div>
                    <h3>Transaction controls</h3>
                    <p className="ops-meta">
                      Set working limits for single transactions, daily cumulative usage, and bulk uploads.
                    </p>
                  </div>
                </div>

                <div className="ops-fields two">
                  <label>
                    Default approval note template
                    <textarea
                      defaultValue={settings?.defaultApprovalNoteTemplate ?? ""}
                      disabled={!canEditSettings}
                      name="defaultApprovalNoteTemplate"
                      placeholder="Submitted by maker for checker approval"
                    />
                  </label>
                  <label>
                    Duplicate Transaction Reference Check
                    <label className="ops-toggle">
                      <input
                        defaultChecked={
                          (settings?.duplicateReferencePolicy ?? "enabled") === "enabled"
                        }
                        disabled={!canEditSettings}
                        name="duplicateReferencePolicy"
                        type="checkbox"
                      />
                      <span className="ops-toggle-track">
                        <span className="ops-toggle-thumb" />
                      </span>
                      <span className="ops-toggle-label">On / Off</span>
                    </label>
                  </label>
                </div>

                <div className="ops-fields three">
                  <label>
                    Max single transaction amount (INR)
                    <input
                      defaultValue={settings?.maxSingleTransactionAmount ?? 500000}
                      disabled={!canEditSettings}
                      inputMode="decimal"
                      min={1}
                      name="maxSingleTransactionAmount"
                      placeholder="500000.00"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <label>
                    Max daily cumulative transaction amount (INR)
                    <input
                      defaultValue={
                        settings?.maxDailyCumulativeTransactionAmount ?? 5000000
                      }
                      disabled={!canEditSettings}
                      inputMode="decimal"
                      min={1}
                      name="maxDailyCumulativeTransactionAmount"
                      placeholder="5000000.00"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <label>
                    Max bulk upload rows
                    <input
                      defaultValue={settings?.maxBulkUploadRows ?? 100}
                      disabled={!canEditSettings}
                      min={1}
                      name="maxBulkUploadRows"
                      required
                      step="1"
                      type="number"
                    />
                  </label>
                </div>

                <div className="ops-actions">
                  <button
                    className="ops-button primary"
                    disabled={busy || !canEditSettings}
                    type="submit"
                  >
                    {busy ? "Saving..." : "Save settings"}
                  </button>
                </div>
              </section>
            </form>
            ) : null}

            {settingsTab === "packages" ? (
              <PackagesSection
                bankTenantId={session?.bankTenantId ?? ""}
                corporateId={selectedCorporateId ?? session?.corporateId ?? ""}
                corporateTenantId={session?.corporateTenantId ?? ""}
                debitAccounts={debitAccounts}
                isNested={true}
              />
            ) : null}

            {settingsTab === "debit-accounts" ? (
              <DebitAccountsSection
                debitAccounts={debitAccounts}
                subscriptions={subscriptions}
                canEdit={canEditSettings}
                session={session}
                selectedCorporateId={selectedCorporateId}
                onUpdate={async () => {
                  if (session) {
                    await refreshWorkspace(session, selectedCorporateId, { silent: true });
                  }
                }}
                isNested={true}
              />
            ) : null}
          </section>
        ) : null}

        {activeTimelineTransaction ? (
          <div
            className="ops-sidesheet-backdrop"
            onClick={() => setActiveTimelineId(null)}
            role="presentation"
          >
            <aside
              aria-labelledby="transaction-details-title"
              aria-modal="true"
              className="ops-sidesheet"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="ops-sidesheet-head">
                <div>
                  <p className="ops-kicker">Payment details</p>
                  <h3 id="transaction-details-title">{activeTimelineTransaction.title}</h3>
                  <p className="ops-meta">{activeTimelineTransaction.batchId}</p>
                </div>
                <button
                  className="ops-kebab"
                  onClick={() => setActiveTimelineId(null)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <TransactionDetailsBody
                debitAccount={activeTransactionDebitAccount}
                subscription={activeTransactionSubscription}
                transaction={activeTimelineTransaction}
              />
            </aside>
          </div>
        ) : null}

        {selectedApprovalDetail && selectedApprovalEntry ? (
          <div
            className="ops-sidesheet-backdrop"
            onClick={() => {
              setSelectedApprovalKey(null);
              setApprovalComment("");
            }}
            role="presentation"
          >
            <aside
              aria-labelledby="approval-sidesheet-title"
              aria-modal="true"
              className="ops-sidesheet"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="ops-sidesheet-head">
                <div>
                  <p className="ops-kicker">{capitalize(selectedApprovalEntry.entity)} approval</p>
                  <h3 id="approval-sidesheet-title">{selectedApprovalDetail.headline}</h3>
                  <span className={`ops-status ${selectedApprovalDetail.badge}`}>
                    {humanize(selectedApprovalDetail.badge)}
                  </span>
                </div>
                <button
                  className="ops-kebab"
                  onClick={() => {
                    setSelectedApprovalKey(null);
                    setApprovalComment("");
                  }}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="ops-stack">
                {selectedApprovalDetail.lines.map((line) => (
                  <p className="ops-meta" key={line}>
                    {line}
                  </p>
                ))}
              </div>

              {selectedApprovalDetail.timeline.length > 0 ? (
                <div className="ops-timeline ops-sidesheet-timeline">
                  <p className="ops-kicker">Timeline</p>
                  {renderTimeline(selectedApprovalDetail.timeline)}
                </div>
              ) : null}

              {hasPermission(session, APPROVAL_PERMISSION_MAP[selectedApprovalEntry.entity]) ? (
                <div className="ops-stack">
                  <label>
                    Checker comment
                    <textarea
                      onChange={(event) => setApprovalComment(event.target.value)}
                      placeholder="Add a review note before approving or rejecting"
                      value={approvalComment}
                    />
                  </label>

                  <div className="ops-row-actions">
                    <button
                      className="ops-button primary"
                      onClick={() =>
                        void handleApproval(
                          selectedApprovalEntry.entity,
                          selectedApprovalEntry.id,
                          "approve"
                        )
                      }
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="ops-button secondary"
                      onClick={() =>
                        void handleApproval(
                          selectedApprovalEntry.entity,
                          selectedApprovalEntry.id,
                          "reject"
                        )
                      }
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <p className="ops-meta">Waiting for checker action.</p>
              )}
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      cache: "no-store"
    });
    const data = (await response.json().catch(() => ({}))) as T & { message?: string };

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message ?? `Request failed with status ${response.status}`,
        raw: data
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: String(error)
    };
  }
}

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = (await response.json().catch(() => ({}))) as T & { message?: string };

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message ?? `Request failed with status ${response.status}`,
        raw: data
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: String(error)
    };
  }
}

function renderTimeline(timeline: PayoutTimelineEvent[]) {
  if (timeline.length === 0) {
    return <p className="ops-meta">No timeline available.</p>;
  }

  return (
    <div className="ops-stack">
      {timeline.map((event, index) => (
        <div key={`${event.event}-${event.at ?? "na"}-${index}`}>
          <strong>{capitalize(event.event)}</strong>
          <p className="ops-meta">
            {(event.userName ?? event.userId ?? "System") + " | " + (event.role ?? "unknown role")}
            <br />
            {formatDateTime(event.at)}
          </p>
        </div>
      ))}
    </div>
  );
}

function hasPermission(
  session: CorporateSession | null,
  permission: CorporatePermission
) {
  if (!session) {
    return false;
  }

  const effectivePermissions =
    session.permissions?.length > 0
      ? session.permissions
      : DEFAULT_ROLE_PERMISSIONS[session.role.toLowerCase()] ?? [];

  return effectivePermissions.includes(permission);
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function optionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function csvToArray(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAmount(value: number) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function maskAccountNumber(value: string) {
  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function createSimpleId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function cryptoAvailableUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return createSimpleId("TXN");
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "FP";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

