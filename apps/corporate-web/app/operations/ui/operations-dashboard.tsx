"use client";

import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const PackagesSection = dynamic(() => import("./packages-section").then((mod) => mod.PackagesSection), {
  ssr: false,
  loading: () => <div className="ops-loading" style={{ padding: "24px", color: "var(--text-secondary)" }}>Loading packages...</div>
});

const DebitAccountsSection = dynamic(() => import("./debit-accounts-section").then((mod) => mod.DebitAccountsSection), {
  ssr: false,
  loading: () => <div className="ops-loading" style={{ padding: "24px", color: "var(--text-secondary)" }}>Loading accounts...</div>
});

const CbsSimulatorSection = dynamic(() => import("./cbs-simulator-section").then((mod) => mod.CbsSimulatorSection), {
  ssr: false,
  loading: () => <div className="ops-loading" style={{ padding: "24px", color: "var(--text-secondary)" }}>Loading CBS simulator...</div>
});

const DevPortalSection = dynamic(() => import("./devportal-section").then((mod) => mod.DevPortalSection), {
  ssr: false,
  loading: () => <div className="ops-loading" style={{ padding: "24px", color: "var(--text-secondary)" }}>Loading developer portal...</div>
});

const TransactionDetailsBody = dynamic(() => import("./detail-panels").then((mod) => mod.TransactionDetailsBody), {
  ssr: false,
  loading: () => <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)" }}>Loading details...</div>
});

import {
  clearSession,
  persistSelectedCorporateId,
  readSelectedCorporateId,
  readSession
} from "../../../lib/session";
import { Chatbot } from "./chatbot";
import { TimeseriesChart } from "./timeseries-chart";
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
  | "cbs-simulator"
  | "approval-matrices"
  | "roles"
  | "users"
  | "devportal"
  | "reports"
  | "audit"
  | "settings";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; raw?: unknown; traceId?: string };

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
      packageCode?: string | null;
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

type ApprovalSectionFilter = "all" | ApprovalEntry["entity"] | "file";

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
  placeholder,
  disabled
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
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
        onClick={() => !disabled && setOpen((current) => !current)}
        style={{
          width: "100%",
          height: "36px",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "0 10px",
          whiteSpace: "normal",
          background: "var(--surface)",
          border: open ? "1px solid var(--border-focus)" : "1px solid var(--border)",
          boxShadow: open ? "0 0 0 2px rgba(37, 99, 235, 0.12)" : "none",
          borderRadius: "var(--radius-md)",
          fontSize: "13px",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.76 : 1,
          transition: "border-color 120ms ease, box-shadow 120ms ease"
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
  { id: "cbs-simulator", label: "CBS Simulator", accent: "Ledger controls" },
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
  "cbs-simulator",
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
    "devportal.edit"
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
  scopes?: Array<
    | "transactions"
    | "file-uploads"
    | "beneficiaries"
    | "approval-matrices"
    | "roles"
    | "users"
    | "subscriptions"
    | "debit-accounts"
    | "settings"
    | "packages"
  >;
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
  const fileApprovalsRef = useRef<HTMLDivElement | null>(null);
  const beneficiaryApprovalsRef = useRef<HTMLDivElement | null>(null);
  const roleApprovalsRef = useRef<HTMLDivElement | null>(null);
  const userApprovalsRef = useRef<HTMLDivElement | null>(null);
  const autoRefreshInFlightRef = useRef(false);
  const latestSessionRef = useRef<CorporateSession | null>(initialSession);
  const latestCorporateIdRef = useRef(initialData.selectedCorporateId);

  const [session, setSession] = useState<CorporateSession | null>(initialSession);
  const [loading, setLoading] = useState(() => {
    const hasData = initialData && initialData.corporates && initialData.corporates.length > 0;
    return !hasData;
  });
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

  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }, []);

  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (notice && notice.tone !== "error") {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const [lastSeenApprovalsTime, setLastSeenApprovalsTime] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cmsLastSeenApprovalsTime");
      if (stored) {
        setLastSeenApprovalsTime(Number(stored));
      }
    }
  }, []);

  useEffect(() => {
    if (activeSection === "approvals") {
      const now = Date.now();
      setLastSeenApprovalsTime(now);
      localStorage.setItem("cmsLastSeenApprovalsTime", String(now));
    }
  }, [activeSection]);

  const hasAnyCheckerPermission = useMemo(() => {
    return (
      hasPermission(session, "transaction.checker") ||
      hasPermission(session, "beneficiary.checker") ||
      hasPermission(session, "roles.checker") ||
      hasPermission(session, "user.checker")
    );
  }, [session]);

  useEffect(() => {
    if (activeSection === "approvals" && session && !hasAnyCheckerPermission) {
      navigateToSection("home");
    }
  }, [activeSection, session, hasAnyCheckerPermission]);

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
  const [packages, setPackages] = useState<any[]>([]);
  const [checkedBatchIds, setCheckedBatchIds] = useState<string[]>([]);
  const [bulkApprovalComment, setBulkApprovalComment] = useState("");
  const [selectedFileApprovalId, setSelectedFileApprovalId] = useState<string | null>(null);
  const [fileBatches, setFileBatches] = useState<PayoutBatch[]>([]);
  const [fileBatchesSearchQuery, setFileBatchesSearchQuery] = useState("");
  const [checkedFileBatchIds, setCheckedFileBatchIds] = useState<string[]>([]);
  const [fileBulkComment, setFileBulkComment] = useState("");

  const [selectedCorporateId, setSelectedCorporateId] = useState(initialData.selectedCorporateId);

  const [showBeneficiaryCreate, setShowBeneficiaryCreate] = useState(false);
  const [isBeneficiaryViewOnly, setIsBeneficiaryViewOnly] = useState(false);
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<string | null>(null);
  const [beneIdError, setBeneIdError] = useState("");
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
  const [beneficiaryFilterPackages, setBeneficiaryFilterPackages] = useState<string[]>([]);
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
  const [fileUploadDatePreset, setFileUploadDatePreset] = useState("all");
  const [fileUploadCustomStart, setFileUploadCustomStart] = useState("");
  const [fileUploadCustomEnd, setFileUploadCustomEnd] = useState("");
  const [showFileUploadDatePicker, setShowFileUploadDatePicker] = useState(false);

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

  const [isRoleViewOnly, setIsRoleViewOnly] = useState(false);
  const [roleSubscriptionIds, setRoleSubscriptionIds] = useState<string[]>([]);
  const [isMatrixViewOnly, setIsMatrixViewOnly] = useState(false);
  const [matrixActionItem, setMatrixActionItem] = useState<ApprovalMatrix | null>(null);
  const [userFilterPackages, setUserFilterPackages] = useState<string[]>([]);
  const [rolePackageFilter, setRolePackageFilter] = useState<string[]>([]);
  const [userActionItem, setUserActionItem] = useState<CorporateUser | null>(null);

  const editingBeneficiary = useMemo(
    () => (editingBeneficiaryId ? beneficiaries.find((item) => item.beneficiaryId === editingBeneficiaryId) ?? null : null),
    [editingBeneficiaryId, beneficiaries]
  );

  const [editingApprovalMatrixId, setEditingApprovalMatrixId] = useState<string | null>(null);
  const [approvalMatrixRoleNamesL1, setApprovalMatrixRoleNamesL1] = useState<string[]>([]);
  const [approvalMatrixRoleNamesL2, setApprovalMatrixRoleNamesL2] = useState<string[]>([]);
  const [approvalMatrixRoleNamesL3, setApprovalMatrixRoleNamesL3] = useState<string[]>([]);
  const [approvalMatrixLevels, setApprovalMatrixLevels] = useState<number>(1);
  const editingApprovalMatrix = useMemo(
    () => (editingApprovalMatrixId ? approvalMatrices.find((item) => item.matrixId === editingApprovalMatrixId) ?? null : null),
    [editingApprovalMatrixId, approvalMatrices]
  );

  useEffect(() => {
    if (editingApprovalMatrix) {
      setApprovalMatrixSubscriptionId(editingApprovalMatrix.subscriptionId ?? "");
      setApprovalMatrixDebitAccountIds(editingApprovalMatrix.debitAccountIds ?? []);
      setApprovalMatrixLevels(editingApprovalMatrix.approvalLevels || 1);

      const l1: string[] = [];
      const l2: string[] = [];
      const l3: string[] = [];
      if (editingApprovalMatrix.roles) {
        for (const roleStr of editingApprovalMatrix.roles) {
          if (roleStr.startsWith("1:")) {
            l1.push(roleStr.substring(2));
          } else if (roleStr.startsWith("2:")) {
            l2.push(roleStr.substring(2));
          } else if (roleStr.startsWith("3:")) {
            l3.push(roleStr.substring(2));
          } else {
            l1.push(roleStr);
            l2.push(roleStr);
            l3.push(roleStr);
          }
        }
      }
      setApprovalMatrixRoleNamesL1([...new Set(l1)]);
      setApprovalMatrixRoleNamesL2([...new Set(l2)]);
      setApprovalMatrixRoleNamesL3([...new Set(l3)]);
    } else {
      setApprovalMatrixSubscriptionId("");
      setApprovalMatrixDebitAccountIds([]);
      setApprovalMatrixLevels(1);
      setApprovalMatrixRoleNamesL1([]);
      setApprovalMatrixRoleNamesL2([]);
      setApprovalMatrixRoleNamesL3([]);
    }
  }, [editingApprovalMatrix]);

  useEffect(() => {
    if (editingRole) {
      const allowedSubs = subscriptions
        .filter((sub) => sub.userAccess.some((access) => access.roleName === editingRole.name))
        .map((sub) => sub.subscriptionId);
      setRoleSubscriptionIds(allowedSubs);
    } else {
      setRoleSubscriptionIds([]);
    }
  }, [editingRole, subscriptions]);

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

    const hasData = initialData && initialData.corporates && initialData.corporates.length > 0;
    if (initialSession && initialData.selectedCorporateId && hasData) {
      if (initialData.selectedCorporateId) {
        persistSelectedCorporateId(initialData.selectedCorporateId);
      }
      return;
    }

    const currentSession = initialSession ?? readSession();
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
    const scopes = options.scopes ?? [];
    const shouldFetch = (scope: any) => scopes.length === 0 || scopes.includes(scope);

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
    const settingsRequest = shouldFetch("settings") && hasPermission(currentSession, "settings.view")
      ? fetchJson<CorporateTenantSettings>(
          `/v1/settings/corporate-tenant?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&actedByUserId=${encodeURIComponent(currentSession.userId)}`
        )
      : Promise.resolve({
          ok: true as const,
          data: settings
        });

    const packagesRequest = shouldFetch("packages")
      ? fetchJson<{ items: any[] }>(
          `/v1/package-catalog/packages?ownerType=corporate&corporateTenantId=${encodeURIComponent(
            currentSession.corporateTenantId
          )}&corporateId=${encodeURIComponent(corporateId)}`
        )
      : Promise.resolve({
          ok: true as const,
          data: { items: packages }
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
      settingsResult,
      packagesResult
    ] = await Promise.all([
      shouldFetch("transactions")
        ? fetchJson<{ items: PayoutBatch[] }>(
            `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: transactions } }),
      shouldFetch("file-uploads")
        ? fetchJson<{ items: PayoutFileUpload[] }>(
            `/v1/payouts/file-uploads?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: fileUploads } }),
      shouldFetch("beneficiaries")
        ? fetchJson<{ items: Beneficiary[] }>(
            `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: beneficiaries } }),
      shouldFetch("approval-matrices")
        ? fetchJson<{ items: ApprovalMatrix[] }>(
            `/v1/approval-matrices?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&_t=${Date.now()}`
          )
        : Promise.resolve({ ok: true as const, data: { items: approvalMatrices } }),
      shouldFetch("roles")
        ? fetchJson<{ items: CorporateRole[] }>(
            `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: roles } }),
      shouldFetch("users")
        ? fetchJson<{ items: CorporateUser[] }>(
            `/v1/auth/users?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: users } }),
      shouldFetch("subscriptions")
        ? fetchJson<{ items: CorporateSubscription[] }>(
            `/v1/subscriptions?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: subscriptions } }),
      shouldFetch("debit-accounts")
        ? fetchJson<{ items: CorporateDebitAccount[] }>(
            `/v1/debit-accounts?corporateTenantId=${encodeURIComponent(currentSession.corporateTenantId)}&corporateId=${encodeURIComponent(corporateId)}`
          )
        : Promise.resolve({ ok: true as const, data: { items: debitAccounts } }),
      settingsRequest,
      packagesRequest
    ]);

    if (shouldFetch("transactions") && transactionsResult.ok) {
      setTransactions(transactionsResult.data.items ?? []);
    }

    if (shouldFetch("file-uploads") && fileUploadsResult.ok) {
      setFileUploads(fileUploadsResult.data.items ?? []);
    }

    if (shouldFetch("beneficiaries") && beneficiariesResult.ok) {
      setBeneficiaries(beneficiariesResult.data.items ?? []);
    }

    if (shouldFetch("approval-matrices") && approvalMatricesResult.ok) {
      setApprovalMatrices(approvalMatricesResult.data.items ?? []);
    }

    if (shouldFetch("roles") && rolesResult.ok) {
      setRoles(rolesResult.data.items ?? []);
    }

    if (shouldFetch("users") && usersResult.ok) {
      setUsers(usersResult.data.items ?? []);
    }
    if (shouldFetch("subscriptions") && subscriptionsResult.ok) {
      setSubscriptions(subscriptionsResult.data.items ?? []);
    }
    if (shouldFetch("debit-accounts") && debitAccountsResult.ok) {
      setDebitAccounts(debitAccountsResult.data.items ?? []);
    }

    if (shouldFetch("settings") && settingsResult.ok && settingsResult.data) {
      setSettings(settingsResult.data);
    }
    if (shouldFetch("packages") && packagesResult.ok) {
      setPackages(packagesResult.data?.items ?? []);
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

      let scopes: RefreshWorkspaceOptions["scopes"] = [];
      if (activeSection === "transactions") {
        scopes = ["transactions", "debit-accounts"];
      } else if (activeSection === "file-uploads") {
        scopes = ["file-uploads", "transactions"];
      } else if (activeSection === "approvals") {
        scopes = ["transactions", "file-uploads", "beneficiaries", "roles", "users"];
      } else if (activeSection === "home") {
        scopes = ["transactions", "debit-accounts", "file-uploads"];
      } else if (activeSection === "beneficiaries") {
        scopes = ["beneficiaries", "packages"];
      } else if (activeSection === "debit-accounts") {
        scopes = ["debit-accounts", "subscriptions"];
      } else if (activeSection === "users") {
        scopes = ["users", "roles"];
      } else if (activeSection === "roles") {
        scopes = ["roles"];
      } else if (activeSection === "settings") {
        scopes = ["settings"];
      } else if (activeSection === "packages") {
        scopes = ["packages"];
      } else if (activeSection === "approval-matrices") {
        scopes = ["approval-matrices"];
      } else {
        scopes = ["debit-accounts"];
      }

      try {
        await Promise.all([
          refreshWorkspace(currentSession, corporateId, { scopes, silent: true }),
          refreshNotifications(currentSession.userId)
        ]);
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    }

    void runAutoRefresh();

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

  useEffect(() => {
    if (session && !canViewSettings) {
      if (activeSection === "settings" || activeSection === "packages" || activeSection === "debit-accounts") {
        navigateToSection("home");
      }
    }
  }, [activeSection, session, canViewSettings]);

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
      selectedTransactionPackageCode
        ? (accessibleSubscriptions.find(
            (subscription) => subscription.packageCode === selectedTransactionPackageCode
          ) ?? null)
        : null,
    [accessibleSubscriptions, selectedTransactionPackageCode]
  );

  const selectedTransactionDebitAccounts = useMemo(
    () => {
      if (selectedTransactionPackageCode) {
        return selectedTransactionSubscription?.debitAccounts ?? [];
      }
      const allAccountsMap = new Map<string, any>();
      for (const sub of accessibleSubscriptions) {
        for (const account of sub.debitAccounts) {
          allAccountsMap.set(account.debitAccountId, account);
        }
      }
      return Array.from(allAccountsMap.values());
    },
    [accessibleSubscriptions, selectedTransactionPackageCode, selectedTransactionSubscription]
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
    let defaultDebitAccountId = "";
    if (selectedTransactionSubscription) {
      defaultDebitAccountId =
        selectedTransactionSubscription.debitAccounts.find((account) => account.isDefault)?.debitAccountId ??
        selectedTransactionSubscription.debitAccounts[0]?.debitAccountId ??
        "";
    } else if (selectedTransactionDebitAccounts.length > 0) {
      defaultDebitAccountId =
        selectedTransactionDebitAccounts.find((account) => account.isDefault)?.debitAccountId ??
        selectedTransactionDebitAccounts[0]?.debitAccountId ??
        "";
    }
    setSelectedTransactionDebitAccountId((current) => current || defaultDebitAccountId);

    const defaultPaymentMethodCode =
      selectedTransactionPaymentMethods[0] ??
      "";
    setSelectedTransactionPaymentMethodCode((current) => current || defaultPaymentMethodCode);
  }, [selectedTransactionPaymentMethods, selectedTransactionSubscription, selectedTransactionDebitAccounts]);

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

  const fileUploadDateRange = useMemo(
    () => buildDateRange(fileUploadDatePreset, fileUploadCustomStart, fileUploadCustomEnd),
    [fileUploadCustomEnd, fileUploadCustomStart, fileUploadDatePreset]
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

      let matchesDate = true;
      if (file.uploadedAt) {
        const uploadedAt = new Date(file.uploadedAt);
        matchesDate =
          (!fileUploadDateRange.start || uploadedAt >= fileUploadDateRange.start) &&
          (!fileUploadDateRange.end || uploadedAt <= fileUploadDateRange.end);
      } else {
        if (fileUploadDateRange.start || fileUploadDateRange.end) {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [fileUploads, fileUploadSearch, fileUploadStatusFilter, fileUploadDateRange]);

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

      const matchesPackage =
        rolePackageFilter.length === 0 ||
        subscriptions.some(
          (sub) =>
            rolePackageFilter.includes(sub.subscriptionId) &&
            sub.userAccess.some(
              (access) =>
                access.roleName.toLowerCase() === role.name.toLowerCase() &&
                access.status === "active"
            )
        );

      return matchesSearch && matchesStatus && matchesPackage;
    });
  }, [roles, roleSearch, roleStatusFilter, rolePackageFilter, subscriptions]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        !userSearch ||
        user.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.username.toLowerCase().includes(userSearch.toLowerCase());

      const matchesStatus = !userStatusFilter || user.status === userStatusFilter;

      const matchesPackages =
        userFilterPackages.length === 0 ||
        subscriptions.some(
          (sub) =>
            userFilterPackages.includes(sub.packageCode) &&
            sub.userAccess.some((access) => access.roleName === user.role)
        );

      return matchesSearch && matchesStatus && matchesPackages;
    });
  }, [users, userSearch, userStatusFilter, userFilterPackages, subscriptions]);

  const filterPackageOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const pkg of packages) {
      if (pkg.packageCode) {
        map.set(pkg.packageCode, pkg.displayName || pkg.name || pkg.packageCode);
      }
    }
    for (const sub of subscriptions) {
      if (sub.packageCode) {
        map.set(sub.packageCode, sub.displayName || sub.packageCode);
      }
    }
    return Array.from(map.entries()).map(([code, name]) => ({
      value: code,
      label: `${name} (${code})`
    }));
  }, [packages, subscriptions]);

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

      const matchesPackages =
        beneficiaryFilterPackages.length === 0 ||
        beneficiary.assignedPackages.some((pkg) => beneficiaryFilterPackages.includes(pkg.packageCode));

      return matchesSearch && matchesStatus && matchesPackages;
    });
  }, [beneficiaries, beneficiarySearch, beneficiaryStatusFilter, beneficiaryFilterPackages]);

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
        .filter((item) => item.state === "pending_approval" || item.state === "partially_approved")
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
          createdAt: item.createdAt ?? undefined,
          packageCode: item.packageCode
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

  const hasNewApprovals = useMemo(() => {
    if (activeSection === "approvals") {
      return false;
    }
    return approvalEntries.some((entry) => {
      if (!entry.createdAt) return false;
      const entryTime = new Date(entry.createdAt).getTime();
      return entryTime > lastSeenApprovalsTime;
    });
  }, [approvalEntries, lastSeenApprovalsTime, activeSection]);

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

  const fileApprovalEntries = useMemo(() => {
    return fileUploads
      .filter((upload) => {
        if (!upload.uploadedAt) return true;
        const uploadedAt = new Date(upload.uploadedAt);
        return (
          (!approvalDateRange.start || uploadedAt >= approvalDateRange.start) &&
          (!approvalDateRange.end || uploadedAt <= approvalDateRange.end)
        );
      })
      .map((upload) => {
        const fileBatchesList = transactions.filter(
          (t) => t.sourceUploadId === upload.uploadId
        );
        const pendingCount = fileBatchesList.filter(
          (t) => t.state === "pending_approval" || t.state === "partially_approved"
        ).length;
        const totalAmountValue = fileBatchesList.reduce(
          (sum, t) => sum + (t.totalAmount?.value ?? 0),
          0
        );

        return {
          uploadId: upload.uploadId,
          fileName: upload.fileName,
          uploadedAt: upload.uploadedAt,
          uploadedByName: upload.uploadedByName || upload.uploadedByUserId,
          totalRows: upload.totalRows,
          createdCount: upload.createdCount,
          pendingCount,
          totalAmount: totalAmountValue
        };
      })
      .filter((file) => file.pendingCount > 0);
  }, [fileUploads, transactions, approvalDateRange]);

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
    setCheckedBatchIds([]);
    setBulkApprovalComment("");

    const sectionRef =
      filter === "transaction"
        ? paymentApprovalsRef
        : filter === "file"
          ? fileApprovalsRef
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
    const isEdit = Boolean(editingBeneficiaryId);

    const beneId = String(formData.get("beneficiaryId")).trim();
    if (!isEdit) {
      if (beneIdError) {
        setNotice({ tone: "error", text: "Please resolve the Beneficiary ID duplicate error before submitting." });
        return;
      }
      if (beneficiaries.some((b) => b.beneficiaryId.trim().toLowerCase() === beneId.toLowerCase())) {
        setNotice({ tone: "error", text: "This Beneficiary ID already exists." });
        return;
      }
    }

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
    setBeneIdError("");
    setShowBeneficiaryCreate(false);
    setEditingBeneficiaryId(null);
    setIsBeneficiaryViewOnly(false);
    setNotice({
      tone: "success",
      text: isEdit
        ? `${payload.name} updated successfully and sent for approval.`
        : `${payload.name} created successfully and sent for approval.`
    });
  }

  const handleBeneIdChange = (val: string) => {
    if (!val) {
      setBeneIdError("");
      return;
    }
    const duplicate = beneficiaries.some(
      (b) => b.beneficiaryId.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (duplicate) {
      setBeneIdError("This Beneficiary ID already exists.");
    } else {
      setBeneIdError("");
    }
  };

  function beginEditBeneficiary(beneficiary: Beneficiary) {
    setBeneficiaryActionItem(null);
    setBeneficiaryActionMenuOpen(false);
    setEditingBeneficiaryId(beneficiary.beneficiaryId);
    setBeneIdError("");
    setIsBeneficiaryViewOnly(false);
    setShowBeneficiaryCreate(true);
    setBeneficiaryPackageCodes(beneficiary.assignedPackages.map((item) => item.packageCode));
  }

  function beginViewBeneficiary(beneficiary: Beneficiary) {
    setBeneficiaryActionItem(null);
    setBeneficiaryActionMenuOpen(false);
    setEditingBeneficiaryId(beneficiary.beneficiaryId);
    setBeneIdError("");
    setIsBeneficiaryViewOnly(true);
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
      void refreshWorkspace(session, selectedCorporateId, { scopes: ["beneficiaries"] });
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
            value: Math.round(Number(formData.get("amount")) * 100),
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
      void refreshWorkspace(session, selectedCorporateId, { scopes: ["transactions", "debit-accounts"] });
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
    void refreshWorkspace(session, selectedCorporateId, { scopes: ["file-uploads", "transactions"] });
  }

  async function handleApprovalMatrixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isRoleMaker) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    const selectedRoles: string[] = [];
    if (approvalMatrixLevels >= 1) {
      approvalMatrixRoleNamesL1.forEach((role) => selectedRoles.push(`1:${role}`));
    }
    if (approvalMatrixLevels >= 2) {
      approvalMatrixRoleNamesL2.forEach((role) => selectedRoles.push(`2:${role}`));
    }
    if (approvalMatrixLevels >= 3) {
      approvalMatrixRoleNamesL3.forEach((role) => selectedRoles.push(`3:${role}`));
    }

    if (selectedRoles.length === 0) {
      setNotice({ tone: "error", text: "Please select at least one role for approval." });
      return;
    }

    if (!approvalMatrixSubscriptionId) {
      setNotice({ tone: "error", text: "Please select a package subscription." });
      return;
    }

    if (approvalMatrixDebitAccountIds.length === 0) {
      setNotice({ tone: "error", text: "Please select at least one debit account." });
      return;
    }

    const isEdit = Boolean(editingApprovalMatrixId);
    const url = isEdit
      ? `/v1/approval-matrices/${encodeURIComponent(editingApprovalMatrixId as string)}`
      : "/v1/approval-matrices";
    const method = isEdit ? "PUT" : "POST";

    setBusy(true);
    const result = await postJson<ApprovalMatrix>(url, {
      name: String(formData.get("name")),
      corporateTenantId: session.corporateTenantId,
      createdByUserId: session.userId,
      subscriptionId: approvalMatrixSubscriptionId,
      debitAccountIds: approvalMatrixDebitAccountIds,
      amountFrom: Math.round(Number(formData.get("amountFrom")) * 100),
      amountTo: Math.round(Number(formData.get("amountTo")) * 100),
      approvalLevels: approvalMatrixLevels,
      roles: selectedRoles,
      status: isEdit && editingApprovalMatrix ? editingApprovalMatrix.status : "active"
    }, method);
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    if (isEdit) {
      setApprovalMatrices((current) =>
        current.map((item) => (item.matrixId === editingApprovalMatrixId ? result.data : item))
      );
    } else {
      setApprovalMatrices((current) => [result.data, ...current]);
    }

    form.reset();
    setApprovalMatrixSubscriptionId("");
    setApprovalMatrixDebitAccountIds([]);
    setApprovalMatrixRoleNames([]);
    setEditingApprovalMatrixId(null);
    setShowApprovalMatrixCreate(false);
    setNotice({
      tone: "success",
      text: isEdit ? "Approval matrix updated successfully." : "Approval matrix created successfully."
    });
    void refreshWorkspace(session, selectedCorporateId, { scopes: ["approval-matrices"] });
  }

  async function handleToggleMatrixStatus(matrix: ApprovalMatrix) {
    if (!session || !isRoleMaker) return;

    const newStatus = matrix.status === "active" ? "inactive" : "active";
    setBusy(true);
    const result = await postJson<ApprovalMatrix>(
      `/v1/approval-matrices/${encodeURIComponent(matrix.matrixId)}`,
      {
        name: matrix.name,
        corporateTenantId: session.corporateTenantId,
        createdByUserId: session.userId,
        subscriptionId: matrix.subscriptionId || "",
        debitAccountIds: matrix.debitAccountIds,
        amountFrom: matrix.amountFrom,
        amountTo: matrix.amountTo,
        approvalLevels: matrix.approvalLevels,
        roles: matrix.roles,
        status: newStatus
      },
      "PUT"
    );
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setApprovalMatrices((current) =>
      current.map((item) => (item.matrixId === matrix.matrixId ? result.data : item))
    );
    setNotice({
      tone: "success",
      text: `Approval matrix status updated to ${newStatus}.`
    });
    void refreshWorkspace(session, selectedCorporateId, { scopes: ["approval-matrices"] });
  }

  function beginEditMatrix(matrix: ApprovalMatrix) {
    setMatrixActionItem(null);
    setIsMatrixViewOnly(false);
    setEditingApprovalMatrixId(matrix.matrixId);
    setShowApprovalMatrixCreate(true);
  }

  function beginViewMatrix(matrix: ApprovalMatrix) {
    setMatrixActionItem(null);
    setIsMatrixViewOnly(true);
    setEditingApprovalMatrixId(matrix.matrixId);
    setShowApprovalMatrixCreate(true);
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

    if (result.ok || result.message === "An action is already in progress by another user, please recheck the status after sometime") {
      setApprovalComment("");
      setSelectedApprovalKey(null);
      let scopes: Array<
        | "transactions"
        | "file-uploads"
        | "beneficiaries"
        | "approval-matrices"
        | "roles"
        | "users"
        | "subscriptions"
        | "debit-accounts"
        | "settings"
        | "packages"
      > = [];
      if (entity === "transaction") {
        scopes = ["transactions", "debit-accounts"];
      } else if (entity === "beneficiary") {
        scopes = ["beneficiaries"];
      } else if (entity === "role") {
        scopes = ["roles"];
      } else if (entity === "user") {
        scopes = ["users"];
      }
      void refreshWorkspace(session, selectedCorporateId, { scopes });

      // Refresh file batches if drawer is active
      if (selectedFileApprovalId) {
        const reloadResult = await fetchJson<{ items: PayoutBatch[] }>(
          `/v1/payouts/file-uploads/${encodeURIComponent(selectedFileApprovalId)}/batches`
        );
        if (reloadResult.ok) {
          setFileBatches(reloadResult.data.items ?? []);
        }
      }
    }
  }

  const isBulkApproveEligible = (entry: ApprovalEntry) => {
    if (entry.entity !== "transaction") return false;
    if (!entry.packageCode) return false;
    const pkg = packages.find((p) => p.packageCode === entry.packageCode);
    return pkg?.bulkApproveEnabled === true;
  };

  async function executeBulkApproval(action: "approve" | "reject") {
    if (!session || checkedBatchIds.length === 0) {
      return;
    }

    if (!hasPermission(session, "transaction.checker")) {
      setNotice({ tone: "error", text: "You do not have permission to check transactions." });
      return;
    }

    setBusy(true);
    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = "";

    await Promise.all(
      checkedBatchIds.map(async (id) => {
        try {
          const endpoint = `/v1/payouts/batches/${encodeURIComponent(id)}/actions`;
          const result = await postJson(endpoint, {
            action,
            actedByUserId: session.userId,
            comment:
              bulkApprovalComment.trim() ||
              `${capitalize(action)}d by checker ${session.username} (Bulk)`
          });
          if (result.ok) {
            successCount++;
          } else {
            failCount++;
            lastErrorMessage = result.message || "Failed";
          }
        } catch {
          failCount++;
          lastErrorMessage = "Network error";
        }
      })
    );

    setBusy(false);
    setCheckedBatchIds([]);
    setBulkApprovalComment("");

    if (failCount === 0) {
      setNotice({
        tone: "success",
        text: `Bulk ${action}d ${successCount} transactions successfully.`
      });
    } else {
      setNotice({
        tone: "error",
        text: `Bulk ${action}: ${successCount} succeeded, ${failCount} failed. Last error: ${lastErrorMessage}`
      });
    }

    void refreshWorkspace(session, selectedCorporateId, { scopes: ["transactions", "debit-accounts"] });
  }

  async function loadFileBatches(uploadId: string) {
    setBusy(true);
    setCheckedFileBatchIds([]);
    setFileBulkComment("");
    setFileBatchesSearchQuery("");
    setSelectedFileApprovalId(uploadId);

    const result = await fetchJson<{ items: PayoutBatch[] }>(
      `/v1/payouts/file-uploads/${encodeURIComponent(uploadId)}/batches`
    );
    setBusy(false);

    if (result.ok) {
      setFileBatches(result.data.items ?? []);
    } else {
      setFileBatches([]);
      setNotice({ tone: "error", text: "Unable to load transactions for this file." });
    }
  }

  async function executeFileBulkAction(action: "approve" | "reject") {
    if (!session || checkedFileBatchIds.length === 0 || !selectedFileApprovalId) {
      return;
    }

    if (!hasPermission(session, "transaction.checker")) {
      setNotice({ tone: "error", text: "You do not have permission to check transactions." });
      return;
    }

    setBusy(true);
    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = "";

    await Promise.all(
      checkedFileBatchIds.map(async (id) => {
        try {
          const endpoint = `/v1/payouts/batches/${encodeURIComponent(id)}/actions`;
          const result = await postJson(endpoint, {
            action,
            actedByUserId: session.userId,
            comment:
              fileBulkComment.trim() ||
              `${capitalize(action)}d by checker ${session.username} (File Bulk)`
          });
          if (result.ok) {
            successCount++;
          } else {
            failCount++;
            lastErrorMessage = result.message || "Failed";
          }
        } catch {
          failCount++;
          lastErrorMessage = "Network error";
        }
      })
    );

    setBusy(false);
    setCheckedFileBatchIds([]);
    setFileBulkComment("");

    if (failCount === 0) {
      setNotice({
        tone: "success",
        text: `Bulk ${action}d ${successCount} transactions from the file successfully.`
      });
    } else {
      setNotice({
        tone: "error",
        text: `Bulk ${action}: ${successCount} succeeded, ${failCount} failed. Last error: ${lastErrorMessage}`
      });
    }

    // Refresh file batches details to reflect updated states in the drawer
    if (selectedFileApprovalId) {
      const reloadResult = await fetchJson<{ items: PayoutBatch[] }>(
        `/v1/payouts/file-uploads/${encodeURIComponent(selectedFileApprovalId)}/batches`
      );
      if (reloadResult.ok) {
        setFileBatches(reloadResult.data.items ?? []);
      }
    }

    void refreshWorkspace(session, selectedCorporateId, { scopes: ["transactions", "debit-accounts", "file-uploads"] });
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
      actedByUserId: session.userId,
      corporateTenantId: session.corporateTenantId,
      name: String(formData.get("name")),
      description: optionalText(formData.get("description")),
      permissions,
      status: String(formData.get("status"))
    };

    setBusy(true);
    const result = editingRoleId
      ? await postJson<CorporateRole>(`/v1/auth/corporate-roles/${encodeURIComponent(editingRoleId)}`, payload, "PUT")
      : await postJson<CorporateRole>("/v1/auth/corporate-roles", payload);

    if (!result.ok) {
      setBusy(false);
      setNotice({ tone: "error", text: result.message });
      return;
    }

    const roleName = String(formData.get("name"));
    const accessResult = await postJson<{ items?: any[] }>("/v1/subscriptions/role-access", {
      corporateTenantId: session.corporateTenantId,
      corporateId: selectedCorporateId,
      roleName: roleName,
      subscriptionIds: roleSubscriptionIds,
      actedByUserId: session.userId
    }, "PUT");

    setBusy(false);

    if (!accessResult.ok) {
      setNotice({ tone: "error", text: accessResult.message });
      return;
    }

    void refreshWorkspace(session, selectedCorporateId, { scopes: ["subscriptions"], silent: true });

    setRoles((current) => [result.data, ...current.filter((item) => item.roleId !== result.data.roleId)]);
    form.reset();
    setShowRoleCreate(false);
    setEditingRoleId(null);
    setNotice({
      tone: "success",
      text: `${roleName} ${editingRoleId ? "updated" : "created"} successfully and sent for approval.`
    });
  }

  function beginEditRole(role: CorporateRole) {
    setRoleActionItem(null);
    setRoleActionMenuOpen(false);
    setIsRoleViewOnly(false);
    setEditingRoleId(role.roleId);
    setShowRoleCreate(true);
  }

  function beginViewRole(role: CorporateRole) {
    setRoleActionItem(null);
    setRoleActionMenuOpen(false);
    setIsRoleViewOnly(true);
    setEditingRoleId(role.roleId);
    setShowRoleCreate(true);
  }

  async function updateRoleStatus(role: CorporateRole, nextStatus: "active" | "inactive") {
    setRoleActionItem(null);
    setRoleActionMenuOpen(false);

    const result = await postJson<CorporateRole>(`/v1/auth/corporate-roles/${encodeURIComponent(role.roleId)}`, {
      createdByUserId: session?.userId ?? "",
      actedByUserId: session?.userId ?? "",
      corporateTenantId: session?.corporateTenantId ?? role.corporateTenantId,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      status: nextStatus
    }, "PUT");

    setNotice({
      tone: result.ok ? "success" : "error",
      text: result.ok ? `Role ${nextStatus === "active" ? "activated" : "deactivated"} successfully.` : result.message
    });

    if (result.ok) {
      setRoles((current) => [result.data, ...current.filter((item) => item.roleId !== result.data.roleId)]);
      void refreshWorkspace(session!, selectedCorporateId, { scopes: ["roles"], silent: true });
    }
  }

  async function updateCorporateUserStatus(user: CorporateUser, nextStatus: "active" | "inactive") {
    setUserActionItem(null);
    setBusy(true);
    const result = await postJson<CorporateUser>(`/v1/auth/users/${encodeURIComponent(user.userId)}/status`, {
      status: nextStatus,
      actedByUserId: session?.userId ?? ""
    }, "PUT");
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }

    setNotice({
      tone: "success",
      text: `User ${user.displayName} is now ${nextStatus === "active" ? "active" : "inactive"}.`
    });

    setUsers((current) =>
      current.map((item) => (item.userId === user.userId ? result.data : item))
    );
    void refreshWorkspace(session!, selectedCorporateId, { scopes: ["users"], silent: true });
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
      maxSingleTransactionAmount: Math.round(Number(formData.get("maxSingleTransactionAmount") ?? 0) * 100),
      maxDailyCumulativeTransactionAmount: Math.round(
        Number(formData.get("maxDailyCumulativeTransactionAmount") ?? 0) * 100
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
            {SECTIONS.filter(
              (section) =>
                PRIMARY_SECTION_IDS.includes(section.id) &&
                (section.id !== "approvals" || hasAnyCheckerPermission)
            ).map((section) => (
              <button
                key={section.id}
                className={activeSection === section.id ? "active" : undefined}
                onClick={() => navigateToSection(section.id)}
                type="button"
              >
                {section.label}
                {section.id === "approvals" && hasNewApprovals && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      backgroundColor: "#EF4444",
                      borderRadius: "50%",
                      display: "inline-block",
                      marginLeft: "6px",
                      verticalAlign: "middle"
                    }}
                  />
                )}
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
            {/* Welcome Banner */}
            <div className="ops-welcome-banner">
              <div>
                <span className="ops-welcome-date">{formattedToday}</span>
                <h2 className="ops-welcome-title">
                  Welcome back, {session?.displayName || session?.username || "Operator"}
                </h2>
                <p className="ops-welcome-subtitle">
                  Here is what's happening at {selectedCorporate?.name ?? "your organization"} today.
                </p>
              </div>
              <div className="ops-welcome-badge">
                <span className="ops-dot active"></span>
                System operational
              </div>
            </div>

            {/* Overview Section Header */}
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

            {/* Clickable Metric Cards */}
            <div className="ops-stripe-metrics-grid">
              <div
                className="ops-stripe-metric-card clickable"
                onClick={() => navigateToSection("transactions")}
              >
                <div className="ops-stripe-metric-label">Total Volume</div>
                <div className="ops-stripe-metric-value">
                  INR {formatAmount(dashboardVolume)}
                </div>
              </div>

              {hasAnyCheckerPermission && (
                <div
                  className="ops-stripe-metric-card clickable"
                  onClick={() => navigateToSection("approvals")}
                >
                  <div className="ops-stripe-metric-label">Pending Approvals</div>
                  <div className="ops-stripe-metric-value">
                    {approvalEntries.length}
                  </div>
                </div>
              )}

              <div
                className="ops-stripe-metric-card clickable"
                onClick={() => navigateToSection("beneficiaries")}
              >
                <div className="ops-stripe-metric-label">Active Beneficiaries</div>
                <div className="ops-stripe-metric-value">
                  {approvedBeneficiaries.length}
                </div>
              </div>

              <div
                className="ops-stripe-metric-card clickable"
                onClick={() => navigateToSection("transactions")}
              >
                <div className="ops-stripe-metric-label">Total Transactions</div>
                <div className="ops-stripe-metric-value">
                  {dashboardTransactions.length}
                </div>
              </div>
            </div>

            {/* Timeseries Transaction Volume Chart */}
            <TimeseriesChart transactions={transactions} />

            {/* Responsive Two-Column Grid */}
            <div className="ops-dashboard-grid">
              {/* Left Column: Recent Activity */}
              <div style={{ minWidth: 0 }}>
                <div className="ops-stripe-section-title" style={{ borderBottom: "none", marginBottom: "8px", paddingBottom: 0 }}>
                  <span>Recent Activity</span>
                  <button
                    className="ops-button secondary ops-mini"
                    onClick={() => navigateToSection("transactions")}
                    type="button"
                  >
                    View all
                  </button>
                </div>

                {/* Styled search field */}
                <div className="ops-toolbar" style={{ marginBottom: "16px" }}>
                  <div className="ops-search-input-wrapper">
                    <span className="ops-search-icon">🔍</span>
                    <input
                      className="ops-search-input"
                      value={homeSearch}
                      onChange={(e) => setHomeSearch(e.target.value)}
                      placeholder="Search by reference, beneficiary..."
                    />
                  </div>
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
                            <td>{formatDateOnly(transaction.createdAt)}</td>
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
                            {dashboardTransactions.length > 0
                              ? "No transactions match the search filter."
                              : "No transactions found for this period."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Widgets */}
              <div>
                {/* Quick Actions Card */}
                <div className="ops-widget-card">
                  <h3 className="ops-widget-title">Quick Actions</h3>
                  <div className="ops-quick-actions-list">
                    <button
                      onClick={() => {
                        setShowTransactionCreate(true);
                        navigateToSection("transactions");
                      }}
                      className="ops-quick-action-btn"
                      type="button"
                    >
                      <span className="ops-action-icon">💸</span>
                      <div className="ops-action-info">
                        <span className="ops-action-label">Create Payout</span>
                        <span className="ops-action-desc">Single immediate bank transfer</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowTransactionBulkUpload(true);
                        navigateToSection("transactions");
                      }}
                      className="ops-quick-action-btn"
                      type="button"
                    >
                      <span className="ops-action-icon">📤</span>
                      <div className="ops-action-info">
                        <span className="ops-action-label">Upload Batch File</span>
                        <span className="ops-action-desc">Excel/CSV bulk transactions</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowBeneficiaryCreate(true);
                        navigateToSection("beneficiaries");
                      }}
                      className="ops-quick-action-btn"
                      type="button"
                    >
                      <span className="ops-action-icon">👤</span>
                      <div className="ops-action-info">
                        <span className="ops-action-label">Add Beneficiary</span>
                        <span className="ops-action-desc">Register new payout receiver</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Approvals Queue Card */}
                {hasAnyCheckerPermission && (
                  <div className="ops-widget-card" style={{ marginTop: "20px" }}>
                    <div className="ops-widget-header">
                      <h3 className="ops-widget-title">Approvals Queue</h3>
                      {approvalEntries.length > 0 ? (
                        <span className="ops-badge-count">{approvalEntries.length} pending</span>
                      ) : null}
                    </div>
                    <div className="ops-approvals-widget-list">
                      {approvalEntries.slice(0, 4).map((entry) => (
                        <div
                          key={`${entry.entity}-${entry.id}`}
                          className="ops-approval-widget-item"
                          onClick={() => navigateToSection("approvals")}
                        >
                          <div className="ops-approval-item-main">
                            <span className="ops-approval-item-title">{entry.title}</span>
                            <span className="ops-approval-item-meta">{entry.meta}</span>
                          </div>
                          <span className="ops-approval-item-arrow">→</span>
                        </div>
                      ))}
                      {approvalEntries.length === 0 ? (
                        <div className="ops-empty-widget">
                          <span className="ops-empty-icon">✓</span>
                          <p style={{ margin: 0, fontSize: "12px" }}>All clear! No pending approvals.</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigateToSection("approvals")}
                          className="ops-widget-link-btn"
                          type="button"
                        >
                          Go to Checker Workbench →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
                      Required columns: Package Code, Transaction Reference, Beneficiary ID, Amount. Optional columns: Payment Method Code, Debit Account Number, Tag, Remark
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
                          required={true}
                          value={selectedTransactionPackageCode}
                          onChange={(event) => {
                            setSelectedTransactionPackageCode(event.target.value);
                            setSelectedTransactionDebitAccountId("");
                            setSelectedTransactionPaymentMethodCode("");
                          }}
                        >
                          <option value="">Select package</option>
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
                          required={true}
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
                          required={true}
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

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", marginBottom: "6px" }}>Date Range</label>
                  <button
                    type="button"
                    className="ops-button secondary"
                    onClick={() => setShowFileUploadDatePicker((current) => !current)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "200px" }}
                  >
                    <span style={{ opacity: 0.7 }}>
                      {fileUploadDatePreset === "all"
                        ? "All time"
                        : fileUploadDatePreset === "today"
                          ? "Today"
                          : fileUploadDatePreset === "yesterday"
                            ? "Yesterday"
                            : fileUploadDatePreset === "week"
                              ? "This week"
                              : fileUploadDatePreset === "month"
                                ? "This month"
                                : "Custom"}
                    </span>
                  </button>

                  {showFileUploadDatePicker ? (
                    <>
                      <div
                        onClick={() => setShowFileUploadDatePicker(false)}
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
                                onClick={() => setFileUploadDatePreset(value)}
                                style={{
                                  justifyContent: "flex-start",
                                  width: "100%",
                                  background: fileUploadDatePreset === value ? "var(--accent-soft)" : "var(--surface)"
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: "grid", gap: "12px", alignContent: "start" }}>
                            {fileUploadDatePreset === "custom" ? (
                              <>
                                <label>
                                  Start date
                                  <input
                                    onChange={(event) => setFileUploadCustomStart(event.target.value)}
                                    type="date"
                                    value={fileUploadCustomStart}
                                  />
                                </label>
                                <label>
                                  End date
                                  <input
                                    onChange={(event) => setFileUploadCustomEnd(event.target.value)}
                                    type="date"
                                    value={fileUploadCustomEnd}
                                  />
                                </label>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                  <button
                                    type="button"
                                    className="ops-button secondary"
                                    onClick={() => setShowFileUploadDatePicker(false)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="ops-button primary"
                                    onClick={() => setShowFileUploadDatePicker(false)}
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
                          setIsBeneficiaryViewOnly(false);
                        } else {
                          setEditingBeneficiaryId(null);
                          setBeneficiaryPackageCodes([]);
                          setIsBeneficiaryViewOnly(false);
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

              {showBeneficiaryCreate && (isBeneficiaryMaker || isBeneficiaryViewOnly) ? (
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
                          disabled={Boolean(editingBeneficiary) || isBeneficiaryViewOnly}
                          onChange={(e) => handleBeneIdChange(e.target.value)}
                          style={beneIdError ? { borderColor: "#DC2626" } : undefined}
                        />
                        {beneIdError ? (
                          <span style={{ color: "#DC2626", fontSize: "12px", marginTop: "4px", display: "block", fontWeight: 500 }}>
                            {beneIdError}
                          </span>
                        ) : null}
                      </label>
                      <label>
                        Bene Name
                        <input
                          defaultValue={editingBeneficiary?.name ?? ""}
                          name="name"
                          placeholder="Orbit Vendor Services"
                          required
                          disabled={isBeneficiaryViewOnly}
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
                          disabled={isBeneficiaryViewOnly}
                        />
                      </label>
                      <label>
                        Bene IFSC Code
                        <input
                          defaultValue={editingBeneficiary?.ifsc ?? ""}
                          name="ifsc"
                          placeholder="HDFC0001234"
                          required
                          disabled={isBeneficiaryViewOnly}
                        />
                      </label>
                      <label>
                        Bene Phone Number
                        <input
                          defaultValue={editingBeneficiary?.phoneNumber ?? ""}
                          name="phoneNumber"
                          placeholder="+91 9876543210"
                          required
                          disabled={isBeneficiaryViewOnly}
                        />
                      </label>
                    </div>

                    <div className="ops-fields one">
                      <label>
                        Packages
                        <CompactMultiDropdown
                          label="beneficiary packages"
                          options={(() => {
                            const activePkgs = packages.filter((p) => (p.status ?? "active") === "active");
                            const activeSubs = subscriptions.filter((s) => s.status === "active");
                            const list = activePkgs.length > 0 ? activePkgs : activeSubs;
                            return list.map((item) => ({
                              value: item.packageCode,
                              label: `${item.name || item.displayName || item.packageCode} (${item.packageCode})`
                            }));
                          })()}
                          values={beneficiaryPackageCodes}
                          onChange={setBeneficiaryPackageCodes}
                          placeholder="Attach packages"
                          disabled={isBeneficiaryViewOnly}
                        />
                      </label>
                    </div>

                    <div className="ops-fields one">
                      <label>
                        Tags
                        <input name="tags" placeholder="Optional, comma separated" disabled={isBeneficiaryViewOnly} />
                      </label>
                    </div>

                    <div className="ops-actions">
                      {isBeneficiaryViewOnly ? (
                        <button
                          className="ops-button secondary"
                          type="button"
                          onClick={() => {
                            setShowBeneficiaryCreate(false);
                            setEditingBeneficiaryId(null);
                            setIsBeneficiaryViewOnly(false);
                            setBeneficiaryPackageCodes([]);
                            setBeneIdError("");
                          }}
                        >
                          Close
                        </button>
                      ) : (
                        <>
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
                                setBeneIdError("");
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
                                setBeneIdError("");
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </form>
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
                <label>
                  Filter by Packages
                  <CompactMultiDropdown
                    label="Packages Filter"
                    options={filterPackageOptions}
                    values={beneficiaryFilterPackages}
                    onChange={setBeneficiaryFilterPackages}
                    placeholder="All packages"
                  />
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
                    {beneficiaryRows.map((beneficiary, index) => {
                      const openUpward = beneficiaryRows.length > 2 && index >= beneficiaryRows.length - 2;
                      return (
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
                          <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="ops-kebab"
                              onClick={() => {
                                if (beneficiaryActionItem?.beneficiaryId === beneficiary.beneficiaryId && beneficiaryActionMenuOpen) {
                                  setBeneficiaryActionMenuOpen(false);
                                  setBeneficiaryActionItem(null);
                                } else {
                                  openBeneficiaryActions(beneficiary);
                                }
                              }}
                              type="button"
                            >
                              ⋮
                            </button>
                            {beneficiaryActionItem?.beneficiaryId === beneficiary.beneficiaryId && beneficiaryActionMenuOpen ? (
                              <>
                                <div
                                  style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: 90,
                                    background: "transparent",
                                    cursor: "default"
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBeneficiaryActionMenuOpen(false);
                                    setBeneficiaryActionItem(null);
                                  }}
                                />
                                <div
                                  className="ops-action-dropdown"
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: openUpward ? "auto" : "100%",
                                    bottom: openUpward ? "100%" : "auto",
                                    zIndex: 100,
                                    minWidth: "160px",
                                    margin: openUpward ? "0 0 4px 0" : "4px 0 0 0",
                                    padding: "6px",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    boxShadow: "var(--shadow-lg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px"
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="ops-action-item"
                                    onClick={() => beginViewBeneficiary(beneficiary)}
                                  >
                                    View
                                  </button>
                                  {isBeneficiaryMaker ? (
                                    <>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() => beginEditBeneficiary(beneficiary)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() =>
                                          void updateBeneficiaryStatusFromMenu(
                                            beneficiary.status === "active" ? "deactivate" : "activate"
                                          )
                                        }
                                      >
                                        {beneficiary.status === "active" ? "Deactivate" : "Activate"}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
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

        {activeSection === "approvals" && hasAnyCheckerPermission ? (
          <section className="ops-page active">
            <section className="ops-panel">
              <div className="ops-panel-head">
                <div>
                  <h3>Checker workbench</h3>
                </div>
              </div>

              <div className="ops-stack">
                <div className="ops-filter-tabs-container">
                  {[
                    {
                      filter: "all" as const,
                      label: "All queues",
                      count:
                        paymentApprovalEntries.length +
                        fileApprovalEntries.length +
                        beneficiaryApprovalEntries.length +
                        roleApprovalEntries.length +
                        userApprovalEntries.length
                    },
                    { filter: "transaction" as const, label: "Payments", count: paymentApprovalEntries.length },
                    { filter: "file" as const, label: "Files", count: fileApprovalEntries.length },
                    { filter: "beneficiary" as const, label: "Beneficiaries", count: beneficiaryApprovalEntries.length },
                    { filter: "role" as const, label: "Roles", count: roleApprovalEntries.length },
                    { filter: "user" as const, label: "Users", count: userApprovalEntries.length }
                  ].map((item) => (
                    <button
                      key={item.filter}
                      className={`ops-filter-tab ${
                        approvalSectionFilter === item.filter ? "active" : ""
                      }`}
                      onClick={() => jumpToApprovalSection(item.filter)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <span className="ops-filter-tab-badge">{item.count}</span>
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

                  {checkedBatchIds.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--accent-soft)",
                        border: "1px solid var(--accent-border)",
                        borderRadius: "12px",
                        marginBottom: "6px"
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                        {checkedBatchIds.length} payments selected for bulk action
                      </span>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Optional comment..."
                          value={bulkApprovalComment}
                          onChange={(e) => setBulkApprovalComment(e.target.value)}
                          className="ops-input"
                          style={{ width: "220px", minHeight: "32px", padding: "4px 10px", fontSize: "12px", background: "var(--surface)" }}
                        />
                        <button
                          type="button"
                          className="ops-button primary"
                          disabled={busy}
                          style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }}
                          onClick={() => executeBulkApproval("approve")}
                        >
                          Approve Selected
                        </button>
                        <button
                          type="button"
                          className="ops-button secondary"
                          disabled={busy}
                          style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px", color: "#DC2626", borderColor: "#FEE2E2" }}
                          onClick={() => executeBulkApproval("reject")}
                        >
                          Reject Selected
                        </button>
                        <button
                          type="button"
                          className="ops-mini"
                          style={{ minHeight: "32px" }}
                          onClick={() => {
                            setCheckedBatchIds([]);
                            setBulkApprovalComment("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

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
                        {paymentApprovalEntries.length > 0 ? (
                          paymentApprovalEntries.map((entry) => {
                            const transaction = transactions.find((t) => t.batchId === entry.id);

                            const beneficiaryName =
                              transaction?.primaryBeneficiaryName ??
                              beneficiaries.find(
                                (beneficiary) =>
                                  beneficiary.beneficiaryId === transaction?.primaryBeneficiaryId
                              )?.name ??
                              transaction?.primaryBeneficiaryId ??
                              "Unknown beneficiary";

                            const packageLabel = transaction?.packageCode ?? "No package";
                            const paymentMethodLabel = transaction?.paymentMethodCode ?? "Not captured";

                            return (
                              <tr
                                className="ops-clickable-row"
                                key={`transaction:${entry.id}`}
                                onClick={() => {
                                  setSelectedApprovalKey(`transaction:${entry.id}`);
                                  setApprovalComment("");
                                  void loadTransactionDetail(entry.id);
                                }}
                              >
                                <td>
                                  <strong>{transaction?.title ?? entry.title}</strong>
                                </td>
                                <td>{beneficiaryName}</td>
                                <td>INR {formatAmount(transaction?.totalAmount.value ?? 0)}</td>
                                <td>{packageLabel}</td>
                                <td>{paymentMethodLabel}</td>
                                <td>{transaction?.tag ?? "Not tagged"}</td>
                                <td>
                                  <span className={`ops-status ${entry.status}`}>
                                    {humanize(entry.status)}
                                  </span>
                                </td>
                                <td>{transaction?.createdAt ? formatDateTime(transaction.createdAt) : "Not available"}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="ops-empty-row" colSpan={8}>
                              No payment approvals pending.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                ) : null}

                {(approvalSectionFilter === "all" || approvalSectionFilter === "file") ? (
                <div className="ops-approval-block" ref={fileApprovalsRef}>
                  <div className="ops-approval-head">
                    <div>
                      <h4>File approvals</h4>
                    </div>
                    <span className="ops-status pending_approval">
                      {fileApprovalEntries.length} pending
                    </span>
                  </div>
                  <div className="ops-table-shell">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>File Name</th>
                          <th>Uploaded At</th>
                          <th>Uploaded By</th>
                          <th>Payments (Pending/Total)</th>
                          <th>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileApprovalEntries.length > 0 ? (
                          fileApprovalEntries.map((file) => (
                            <tr
                              className="ops-clickable-row"
                              key={file.uploadId}
                              onClick={() => void loadFileBatches(file.uploadId)}
                            >
                              <td><strong>{file.fileName}</strong></td>
                              <td>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString("en-IN") : "Unknown"}</td>
                              <td>{file.uploadedByName}</td>
                              <td>
                                <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                                  {file.pendingCount}
                                </span>
                                <span style={{ opacity: 0.6 }}> / {file.createdCount}</span>
                              </td>
                              <td>INR {formatAmount(file.totalAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="ops-empty-row" colSpan={5}>
                              No file approvals pending.
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
                    onClick={() => {
                      if (showApprovalMatrixCreate) {
                        setEditingApprovalMatrixId(null);
                      }
                      setShowApprovalMatrixCreate((current) => !current);
                    }}
                    type="button"
                  >
                    {showApprovalMatrixCreate ? (editingApprovalMatrixId ? "Close edit" : "Close form") : "Create matrix"}
                  </button>
                ) : null}
              </div>

              {showApprovalMatrixCreate && (isRoleMaker || isMatrixViewOnly) ? (
                <div className="ops-drawer">
                  <form
                    className="ops-form"
                    key={editingApprovalMatrixId ?? "create"}
                    onSubmit={handleApprovalMatrixSubmit}
                  >
                    <h4 style={{ marginBottom: "16px" }}>
                      {isMatrixViewOnly ? "View Approval Matrix" : editingApprovalMatrixId ? "Edit Approval Matrix" : "Create Approval Matrix"}
                    </h4>
                    <div className="ops-fields two">
                      <label>
                        Matrix name
                        <input
                          defaultValue={editingApprovalMatrix?.name ?? ""}
                          name="name"
                          placeholder="Vendor payment standard matrix"
                          required
                          disabled={isMatrixViewOnly}
                        />
                      </label>
                      <label>
                        Package subscription
                        <select
                          name="subscriptionId"
                          required
                          value={approvalMatrixSubscriptionId}
                          onChange={(event) => {
                            const nextSubId = event.target.value;
                            setApprovalMatrixSubscriptionId(nextSubId);
                            if (!nextSubId) {
                              setApprovalMatrixDebitAccountIds([]);
                            } else {
                              const selectedSub = subscriptions.find(
                                (sub) => sub.subscriptionId === nextSubId
                              );
                              const allowedIds = new Set(
                                selectedSub ? selectedSub.debitAccounts.map((da) => da.debitAccountId) : []
                              );
                              setApprovalMatrixDebitAccountIds((current) =>
                                current.filter((id) => allowedIds.has(id))
                              );
                            }
                          }}
                          disabled={isMatrixViewOnly}
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
                        <input
                          defaultValue={editingApprovalMatrix?.amountFrom ?? ""}
                          min="0"
                          name="amountFrom"
                          required
                          step="0.01"
                          type="number"
                          disabled={isMatrixViewOnly}
                        />
                      </label>
                      <label>
                        To Amount
                        <input
                          defaultValue={editingApprovalMatrix?.amountTo ?? ""}
                          min="0"
                          name="amountTo"
                          required
                          step="0.01"
                          type="number"
                          disabled={isMatrixViewOnly}
                        />
                      </label>
                    </div>

                    <div className="ops-fields two">
                      <label>
                        Number of Approval Level
                        <select
                          value={approvalMatrixLevels}
                          onChange={(event) => setApprovalMatrixLevels(Number(event.target.value))}
                          name="approvalLevels"
                          required
                          disabled={isMatrixViewOnly}
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>
                      <label>
                        Debit accounts
                        <CompactMultiDropdown
                          label="approval matrix debit accounts"
                          options={(() => {
                            const selectedSubscription = subscriptions.find(
                              (sub) => sub.subscriptionId === approvalMatrixSubscriptionId
                            );
                            if (!selectedSubscription) return [];
                            const allowedIds = new Set(
                              selectedSubscription.debitAccounts
                                .filter((da) => da.status === "active")
                                .map((da) => da.debitAccountId)
                            );
                            return debitAccounts
                              .filter((account) => account.status === "active" && allowedIds.has(account.debitAccountId))
                              .map((account) => ({
                                value: account.debitAccountId,
                                label: `${account.accountName} (${account.accountNumber})`
                              }));
                          })()}
                          values={approvalMatrixDebitAccountIds}
                          onChange={setApprovalMatrixDebitAccountIds}
                          placeholder={approvalMatrixSubscriptionId ? "Select debit accounts" : "Select a subscription first"}
                          disabled={isMatrixViewOnly || !approvalMatrixSubscriptionId}
                        />
                      </label>
                    </div>

                    <div className="ops-fields one" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {approvalMatrixLevels >= 1 && (
                        <label>
                          Level 1 Approval Roles *
                          <CompactMultiDropdown
                            label="level 1 approval roles"
                            options={approvedTransactionCheckerRoles.map((role) => ({
                              value: role.name,
                              label: role.name
                            }))}
                            values={approvalMatrixRoleNamesL1}
                            onChange={setApprovalMatrixRoleNamesL1}
                            placeholder="Select Level 1 roles"
                            disabled={isMatrixViewOnly}
                          />
                        </label>
                      )}

                      {approvalMatrixLevels >= 2 && (
                        <label style={{ marginTop: "8px" }}>
                          Level 2 Approval Roles *
                          <CompactMultiDropdown
                            label="level 2 approval roles"
                            options={approvedTransactionCheckerRoles.map((role) => ({
                              value: role.name,
                              label: role.name
                            }))}
                            values={approvalMatrixRoleNamesL2}
                            onChange={setApprovalMatrixRoleNamesL2}
                            placeholder="Select Level 2 roles"
                            disabled={isMatrixViewOnly}
                          />
                        </label>
                      )}

                      {approvalMatrixLevels >= 3 && (
                        <label style={{ marginTop: "8px" }}>
                          Level 3 Approval Roles *
                          <CompactMultiDropdown
                            label="level 3 approval roles"
                            options={approvedTransactionCheckerRoles.map((role) => ({
                              value: role.name,
                              label: role.name
                            }))}
                            values={approvalMatrixRoleNamesL3}
                            onChange={setApprovalMatrixRoleNamesL3}
                            placeholder="Select Level 3 roles"
                            disabled={isMatrixViewOnly}
                          />
                        </label>
                      )}
                    </div>

                    <div className="ops-actions">
                      {isMatrixViewOnly ? (
                        <button
                          className="ops-button secondary"
                          type="button"
                          onClick={() => {
                            setShowApprovalMatrixCreate(false);
                            setEditingApprovalMatrixId(null);
                            setIsMatrixViewOnly(false);
                          }}
                          style={{ minWidth: "120px" }}
                        >
                          Close
                        </button>
                      ) : (
                        <>
                          <button className="ops-button primary" disabled={busy} type="submit">
                            {busy ? "Saving..." : editingApprovalMatrixId ? "Save updates" : "Create approval matrix"}
                          </button>
                          {editingApprovalMatrixId ? (
                            <button
                              className="ops-button"
                              disabled={busy}
                              type="button"
                              onClick={() => {
                                setShowApprovalMatrixCreate(false);
                                setEditingApprovalMatrixId(null);
                              }}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
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
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApprovalMatrices.map((matrix, index) => {
                      const openUpward = filteredApprovalMatrices.length > 2 && index >= filteredApprovalMatrices.length - 2;
                      return (
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
                        <td>
                          <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="ops-kebab"
                              onClick={() => setMatrixActionItem((current) => (current?.matrixId === matrix.matrixId ? null : matrix))}
                              type="button"
                            >
                              ⋮
                            </button>
                            {matrixActionItem?.matrixId === matrix.matrixId ? (
                              <>
                                <div
                                  style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: 90,
                                    background: "transparent",
                                    cursor: "default"
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMatrixActionItem(null);
                                  }}
                                />
                                <div
                                  className="ops-action-dropdown"
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: openUpward ? "auto" : "100%",
                                    bottom: openUpward ? "100%" : "auto",
                                    zIndex: 100,
                                    minWidth: "160px",
                                    margin: openUpward ? "0 0 4px 0" : "4px 0 0 0",
                                    padding: "6px",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    boxShadow: "var(--shadow-lg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px"
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="ops-action-item"
                                    onClick={() => beginViewMatrix(matrix)}
                                  >
                                    View
                                  </button>
                                  {isRoleMaker && (
                                    <>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() => beginEditMatrix(matrix)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() => void handleToggleMatrixStatus(matrix)}
                                      >
                                        {matrix.status === "active" ? "Deactivate" : "Activate"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredApprovalMatrices.length === 0 ? (
                      <tr>
                        <td className="ops-empty" colSpan={7}>
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
                        setIsRoleViewOnly(false);
                      } else {
                        setEditingRoleId(null);
                        setIsRoleViewOnly(false);
                        setShowRoleCreate(true);
                      }
                    }}
                    type="button"
                  >
                    {showRoleCreate ? (editingRole ? "Close edit" : "Close form") : "Create role"}
                  </button>
                ) : null}
              </div>

              {showRoleCreate && (isRoleMaker || isRoleViewOnly) ? (
                <div className="ops-drawer">
                  <form
                    className="ops-form"
                    key={editingRole?.roleId ?? "role-create"}
                    onSubmit={handleRoleSubmit}
                  >
                    <h4 style={{ marginBottom: "16px" }}>
                      {isRoleViewOnly ? "View Role" : editingRole ? "Edit Role" : "Create Role"}
                    </h4>
                    <div className="ops-fields three">
                      <label>
                        Role name
                        <input
                          defaultValue={editingRole?.name ?? ""}
                          name="name"
                          placeholder="Finance checker"
                          required
                          disabled={isRoleViewOnly}
                        />
                      </label>
                      <label>
                        Status
                        <select defaultValue={editingRole?.status ?? "inactive"} name="status" required disabled={isRoleViewOnly}>
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
                          disabled={isRoleViewOnly}
                        />
                      </label>
                    </div>
                    <div className="ops-fields one" style={{ marginTop: "12px" }}>
                      <label>
                        Allowed Packages
                        <CompactMultiDropdown
                          label="allowed packages"
                          options={subscriptions
                            .filter((sub) => sub.status === "active")
                            .map((sub) => ({
                              value: sub.subscriptionId,
                              label: `${sub.displayName} (${sub.packageCode})`
                            }))}
                          values={roleSubscriptionIds}
                          onChange={setRoleSubscriptionIds}
                          placeholder="Select allowed packages for this role"
                          disabled={isRoleViewOnly}
                        />
                      </label>
                    </div>
                    <div className="ops-permission-grid">
                      {PERMISSION_GROUPS.map((group) => (
                        <section className="ops-permission-card" key={group.label}>
                          <h4>{group.label}</h4>
                          <div className="ops-permission-list">
                            {group.items.map((permission) => (
                              <label className="ops-permission-item" key={permission.value} style={{ cursor: isRoleViewOnly ? "not-allowed" : "pointer" }}>
                                <input
                                  name="permissions"
                                  type="checkbox"
                                  value={permission.value}
                                  defaultChecked={editingRole?.permissions.includes(permission.value) ?? false}
                                  disabled={isRoleViewOnly}
                                />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <div className="ops-actions">
                      {isRoleViewOnly ? (
                        <button
                          className="ops-button secondary"
                          type="button"
                          onClick={() => {
                            setShowRoleCreate(false);
                            setEditingRoleId(null);
                            setIsRoleViewOnly(false);
                          }}
                          style={{ minWidth: "120px" }}
                        >
                          Close
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </form>
                </div>
              ) : null}

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={roleStatusFilter} onChange={(e) => setRoleStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactive</option>
                  </select>
                </label>
                <label style={{ minWidth: "220px", flex: 1.2 }}>
                  Filter by Package
                  <CompactMultiDropdown
                    label="packages"
                    options={subscriptions
                      .filter((sub) => sub.status === "active")
                      .map((sub) => ({
                        value: sub.subscriptionId,
                        label: `${sub.displayName} (${sub.packageCode})`
                      }))}
                    values={rolePackageFilter}
                    onChange={setRolePackageFilter}
                    placeholder="All packages"
                  />
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
                      <th>Status</th>
                      <th>Approval</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.map((role, index) => {
                      const openUpward = filteredRoles.length > 2 && index >= filteredRoles.length - 2;
                      return (
                        <tr key={role.roleId}>
                        <td>{role.name}</td>
                        <td>{role.roleId}</td>
                        <td>{role.description ?? "No description"}</td>
                        <td>
                          <span className={`ops-status ${role.status}`}>{humanize(role.status)}</span>
                        </td>
                        <td>
                          <span className={`ops-status ${role.approvalState}`}>
                            {humanize(role.approvalState)}
                          </span>
                        </td>
                        <td>
                          <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="ops-kebab"
                              onClick={() => setRoleActionItem((current) => (current?.roleId === role.roleId ? null : role))}
                              type="button"
                            >
                              ⋮
                            </button>
                            {roleActionItem?.roleId === role.roleId ? (
                              <>
                                <div
                                  style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: 90,
                                    background: "transparent",
                                    cursor: "default"
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleActionItem(null);
                                  }}
                                />
                                <div
                                  className="ops-action-dropdown"
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: openUpward ? "auto" : "100%",
                                    bottom: openUpward ? "100%" : "auto",
                                    zIndex: 100,
                                    minWidth: "160px",
                                    margin: openUpward ? "0 0 4px 0" : "4px 0 0 0",
                                    padding: "6px",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    boxShadow: "var(--shadow-lg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px"
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="ops-action-item"
                                    onClick={() => beginViewRole(role)}
                                  >
                                    View
                                  </button>
                                  {isRoleMaker && (
                                    <>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() => beginEditRole(role)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="ops-action-item"
                                        onClick={() =>
                                          void updateRoleStatus(
                                            role,
                                            role.status === "active" ? "inactive" : "active"
                                          )
                                        }
                                      >
                                        {role.status === "active" ? "Deactivate" : "Activate"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredRoles.length === 0 ? (
                      <tr>
                        <td className="ops-empty-row" colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                          {roles.length > 0 ? "No roles match the current filters." : "No roles configured yet."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

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

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
                <label style={{ minWidth: "160px", flex: 1 }}>
                  Status
                  <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactive</option>
                  </select>
                </label>
                <label style={{ minWidth: "200px", flex: 1 }}>
                  Filter by Packages
                  <CompactMultiDropdown
                    label="User Packages Filter"
                    options={filterPackageOptions}
                    values={userFilterPackages}
                    onChange={setUserFilterPackages}
                    placeholder="All packages"
                  />
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
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => {
                      const openUpward = filteredUsers.length > 2 && index >= filteredUsers.length - 2;
                      return (
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
                        <td>
                          {isUserMaker ? (
                            <div className="ops-row-action-wrap" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="ops-kebab"
                                onClick={() => setUserActionItem((current) => (current?.userId === user.userId ? null : user))}
                                type="button"
                              >
                                ⋮
                              </button>
                              {userActionItem?.userId === user.userId ? (
                                <>
                                  <div
                                    style={{
                                      position: "fixed",
                                      inset: 0,
                                      zIndex: 90,
                                      background: "transparent",
                                      cursor: "default"
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUserActionItem(null);
                                    }}
                                  />
                                  <div
                                    className="ops-action-dropdown"
                                    style={{
                                      position: "absolute",
                                      right: 0,
                                      top: openUpward ? "auto" : "100%",
                                      bottom: openUpward ? "100%" : "auto",
                                      zIndex: 100,
                                      minWidth: "160px",
                                      margin: openUpward ? "0 0 4px 0" : "4px 0 0 0",
                                      padding: "6px",
                                      background: "var(--surface)",
                                      border: "1px solid var(--border)",
                                      borderRadius: "8px",
                                      boxShadow: "var(--shadow-lg)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "2px"
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="ops-action-item"
                                      onClick={() =>
                                        void updateCorporateUserStatus(
                                          user,
                                          user.status === "active" ? "inactive" : "active"
                                        )
                                      }
                                    >
                                      {user.status === "active" ? "Deactivate" : "Activate"}
                                    </button>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span className="ops-meta">Maker only</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td className="ops-empty-row" colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
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
          <DevPortalSection bankOpsPortalBase={process.env.NEXT_PUBLIC_BANK_OPS_WEB_URL || "http://127.0.0.1:3002"} />
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

                <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", padding: "0" }}>
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

              <div className="ops-toolbar" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "end", padding: "0" }}>
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

        {activeSection === "packages" && canViewSettings ? (
          <PackagesSection
            corporateTenantId={session.corporateTenantId}
            corporateId={selectedCorporateId}
            bankTenantId={session.bankTenantId}
            debitAccounts={debitAccounts}
            canEdit={canEditSettings}
          />
        ) : null}

        {activeSection === "debit-accounts" && canViewSettings ? (
          <DebitAccountsSection
            debitAccounts={debitAccounts}
            subscriptions={subscriptions}
            canEdit={canEditSettings}
            session={session}
            selectedCorporateId={selectedCorporateId}
            onUpdate={async () => {
              if (session) {
                await refreshWorkspace(session, selectedCorporateId, { scopes: ["debit-accounts", "subscriptions"], silent: true });
              }
            }}
          />
        ) : null}

        {activeSection === "cbs-simulator" && canViewSettings ? (
          <CbsSimulatorSection
            debitAccounts={debitAccounts}
            session={session}
            selectedCorporateId={selectedCorporateId}
            onUpdate={async () => {
              if (session) {
                await refreshWorkspace(session, selectedCorporateId, { scopes: ["debit-accounts"], silent: true });
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
                      defaultValue={settings ? settings.maxSingleTransactionAmount / 100 : 500000}
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
                        settings ? settings.maxDailyCumulativeTransactionAmount / 100 : 5000000
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
                canEdit={canEditSettings}
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
                    await refreshWorkspace(session, selectedCorporateId, { scopes: ["debit-accounts", "subscriptions"], silent: true });
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

        {selectedFileApprovalId ? (
          (() => {
            const currentFile = fileUploads.find(f => f.uploadId === selectedFileApprovalId);
            const filteredBatches = fileBatches.filter(b => {
              const query = fileBatchesSearchQuery.trim().toLowerCase();
              return !query ||
                b.batchId.toLowerCase().includes(query) ||
                b.title.toLowerCase().includes(query) ||
                (b.primaryBeneficiaryName && b.primaryBeneficiaryName.toLowerCase().includes(query));
            });
            const pendingFileBatches = fileBatches.filter(
              (b) => b.state === "pending_approval" || b.state === "partially_approved"
            );
            const pendingFilteredBatches = filteredBatches.filter(
              (b) => b.state === "pending_approval" || b.state === "partially_approved"
            );

            const eligiblePendingFileBatches = pendingFileBatches;
            const eligiblePendingFilteredBatches = pendingFilteredBatches;

            return (
              <div
                className="ops-sidesheet-backdrop"
                onClick={() => {
                  setSelectedFileApprovalId(null);
                  setFileBatches([]);
                  setCheckedFileBatchIds([]);
                  setFileBulkComment("");
                }}
                role="presentation"
              >
                <aside
                  aria-labelledby="file-approval-sidesheet-title"
                  aria-modal="true"
                  className="ops-sidesheet"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  style={{ width: "min(680px, calc(100vw - 40px))" }}
                >
                  <div className="ops-sidesheet-head">
                    <div>
                      <p className="ops-kicker">File approval details</p>
                      <h3 id="file-approval-sidesheet-title">{currentFile?.fileName ?? "File upload details"}</h3>
                      <p className="ops-meta" style={{ marginTop: "4px" }}>
                        ID: {selectedFileApprovalId} · Pending: {pendingFileBatches.length} / {fileBatches.length}
                      </p>
                    </div>
                    <button
                      className="ops-kebab"
                      onClick={() => {
                        setSelectedFileApprovalId(null);
                        setFileBatches([]);
                        setCheckedFileBatchIds([]);
                        setFileBulkComment("");
                      }}
                      type="button"
                    >
                      Close
                    </button>
                  </div>

                  <div className="ops-stack" style={{ gap: "16px", flex: 1, overflow: "auto" }}>
                    <div style={{ display: "flex", gap: "12px", background: "var(--surface-subtle)", padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--text-secondary)" }}>Total Amount</span>
                        <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "2px" }}>
                          INR {formatAmount(fileBatches.reduce((sum, b) => sum + (b.totalAmount?.value ?? 0), 0))}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--text-secondary)" }}>Validation</span>
                        <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px", display: "flex", gap: "10px" }}>
                          <span style={{ color: "var(--success)" }}>✓ {currentFile?.createdCount ?? 0} created</span>
                          {currentFile?.rejectedCount ? (
                            <span style={{ color: "#DC2626" }}>✗ {currentFile.rejectedCount} rejected</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="ops-toolbar" style={{ margin: 0 }}>
                      <label style={{ width: "100%" }}>
                        Search payments inside file
                        <input
                          value={fileBatchesSearchQuery}
                          onChange={(e) => setFileBatchesSearchQuery(e.target.value)}
                          placeholder="Search batch UUID, reference, beneficiary name..."
                          style={{ background: "var(--surface)" }}
                        />
                      </label>
                    </div>

                    {/* Bulk panel removed from top */}

                    <div className="ops-table-shell" style={{ border: "1px solid var(--border)", borderRadius: "10px" }}>
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th style={{ width: "36px", textAlign: "center" }}>
                              {eligiblePendingFilteredBatches.length > 0 && (
                                <input
                                  type="checkbox"
                                  checked={
                                    eligiblePendingFilteredBatches.length > 0 &&
                                    eligiblePendingFilteredBatches.every(b => checkedFileBatchIds.includes(b.batchId))
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setCheckedFileBatchIds(prev => {
                                        const newlyAdded = eligiblePendingFilteredBatches.map(b => b.batchId).filter(id => !prev.includes(id));
                                        return [...prev, ...newlyAdded];
                                      });
                                    } else {
                                      const eligiblePendingIds = eligiblePendingFilteredBatches.map(b => b.batchId);
                                      setCheckedFileBatchIds(prev => prev.filter(id => !eligiblePendingIds.includes(id)));
                                    }
                                  }}
                                />
                              )}
                            </th>
                            <th>Reference</th>
                            <th>Beneficiary</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBatches.length > 0 ? (
                            filteredBatches.map((batch) => {
                              const isPending = batch.state === "pending_approval" || batch.state === "partially_approved";
                              return (
                                <tr
                                  className="ops-clickable-row"
                                  key={batch.batchId}
                                  onClick={() => {
                                    setSelectedApprovalKey(`transaction:${batch.batchId}`);
                                    setApprovalComment("");
                                    void loadTransactionDetail(batch.batchId);
                                  }}
                                >
                                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                                    {isPending ? (
                                      <input
                                        type="checkbox"
                                        checked={checkedFileBatchIds.includes(batch.batchId)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setCheckedFileBatchIds(prev => [...prev, batch.batchId]);
                                          } else {
                                            setCheckedFileBatchIds(prev => prev.filter(id => id !== batch.batchId));
                                          }
                                        }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>✓</span>
                                    )}
                                  </td>
                                  <td>
                                    <div>{batch.title}</div>
                                    <span style={{ fontSize: "10px", opacity: 0.6 }}>{batch.batchId}</span>
                                  </td>
                                  <td>{batch.primaryBeneficiaryName ?? "Unknown"}</td>
                                  <td>INR {formatAmount(batch.totalAmount?.value ?? 0)}</td>
                                  <td>
                                    <span className={`ops-status ${batch.state}`}>
                                      {humanize(batch.state)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="ops-empty-row" colSpan={5}>
                                No payments found in this file.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Sticky Footer Bulk Action Panel */}
                  {eligiblePendingFileBatches.length > 0 && hasPermission(session, "transaction.checker") && (
                    <div
                      style={{
                        marginTop: "auto",
                        padding: "16px",
                        background: "var(--surface-subtle)",
                        borderTop: "1px solid var(--border)",
                        borderRadius: "0 0 18px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        zIndex: 10
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                          {checkedFileBatchIds.length} of {eligiblePendingFileBatches.length} payments selected
                        </span>
                        <button
                          type="button"
                          className="ops-mini"
                          style={{ padding: "0 10px", height: "26px", fontSize: "11px", fontWeight: 600 }}
                          onClick={() => setCheckedFileBatchIds(checkedFileBatchIds.length === eligiblePendingFileBatches.length ? [] : eligiblePendingFileBatches.map(b => b.batchId))}
                        >
                          {checkedFileBatchIds.length === eligiblePendingFileBatches.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Add a review note/comment for selected payments..."
                          value={fileBulkComment}
                          onChange={(e) => setFileBulkComment(e.target.value)}
                          className="ops-input"
                          style={{ flex: 1, minHeight: "36px", padding: "6px 12px", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
                        />
                        <button
                          type="button"
                          className="ops-button primary"
                          disabled={busy || checkedFileBatchIds.length === 0}
                          style={{ minHeight: "36px", padding: "0 16px", fontSize: "12px", borderRadius: "8px" }}
                          onClick={() => executeFileBulkAction("approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ops-button secondary"
                          disabled={busy || checkedFileBatchIds.length === 0}
                          style={{ minHeight: "36px", padding: "0 16px", fontSize: "12px", color: "#DC2626", borderColor: "#FEE2E2", borderRadius: "8px" }}
                          onClick={() => executeFileBulkAction("reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            );
          })()
        ) : null}
      </main>
      {session && <Chatbot session={session} />}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      cache: "no-store"
    });
    const data = (await response.json().catch(() => ({}))) as T & { message?: string };
    const traceId = response.headers.get("x-correlation-id") || response.headers.get("x-trace-id") || undefined;

    if (!response.ok) {
      const originalMessage = data.message ?? `Request failed with status ${response.status}`;
      const prefixedMessage = traceId ? `[Trace: ${traceId}] ${originalMessage}` : originalMessage;
      return {
        ok: false,
        status: response.status,
        message: prefixedMessage,
        raw: data,
        traceId
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

async function postJson<T>(url: string, body: unknown, method: string = "POST"): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = (await response.json().catch(() => ({}))) as T & { message?: string };
    const traceId = response.headers.get("x-correlation-id") || response.headers.get("x-trace-id") || undefined;

    if (!response.ok) {
      const originalMessage = data.message ?? `Request failed with status ${response.status}`;
      const prefixedMessage = traceId ? `[Trace: ${traceId}] ${originalMessage}` : originalMessage;
      return {
        ok: false,
        status: response.status,
        message: prefixedMessage,
        raw: data,
        traceId
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

  const roleLower = (session.role ?? "").toLowerCase();
  const customPermissions = [...(session.permissions ?? [])];

  if (roleLower.includes("checker") && !customPermissions.includes("transaction.checker")) {
    customPermissions.push(
      "transaction.checker",
      "beneficiary.checker",
      "roles.checker",
      "user.checker"
    );
  }
  if (roleLower.includes("maker") && !customPermissions.includes("transaction.make")) {
    customPermissions.push(
      "transaction.make",
      "beneficiary.make",
      "roles.make",
      "user.make"
    );
  }

  const effectivePermissions =
    customPermissions.length > 0
      ? customPermissions
      : DEFAULT_ROLE_PERMISSIONS[roleLower] ?? [];

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
  return Number(value / 100).toLocaleString("en-IN", {
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

function formatDateOnly(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
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

