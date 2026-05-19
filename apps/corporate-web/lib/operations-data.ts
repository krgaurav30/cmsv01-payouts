import type {
  ApprovalMatrix,
  BankTenant,
  Beneficiary,
  Corporate,
  CorporateSession,
  CorporateRole,
  CorporateTenant,
  CorporateTenantSettings,
  CorporateUser,
  OperationsInitialData,
  PayoutBatch,
  PayoutFileUpload
} from "./types";

const API_BASE = "http://127.0.0.1:3101";

export async function loadOperationsInitialData(
  session: CorporateSession,
  selectedCorporateCookieValue?: string | null
): Promise<OperationsInitialData> {
  const [bankTenants, corporateTenants, corporates] = await Promise.all([
    fetchApi<{ items: BankTenant[] }>("/v1/tenants/banks", { items: [] }),
    fetchApi<{ items: CorporateTenant[] }>(
      `/v1/tenants/corporates?status=active&bankTenantId=${encodeURIComponent(session.bankTenantId)}`
    , { items: [] }),
    fetchApi<{ items: Corporate[] }>(
      `/v1/corporates?status=active&corporateTenantId=${encodeURIComponent(session.corporateTenantId)}`
    , { items: [] })
  ]);

  const availableCorporates = corporates.items ?? [];
  const selectedCorporateId =
    normalizeCookieValue(selectedCorporateCookieValue) ??
    session.corporateId ??
    availableCorporates[0]?.corporateId ??
    "";

  if (!selectedCorporateId) {
    return {
      selectedCorporateId: "",
      bankTenants: bankTenants.items ?? [],
      corporateTenants: corporateTenants.items ?? [],
      corporates: availableCorporates,
      beneficiaries: [],
      transactions: [],
      fileUploads: [],
      approvalMatrices: [],
      roles: [],
      users: [],
      settings: null
    };
  }

  const settingsRequest = session.permissions.includes("settings.view")
    ? fetchApi<CorporateTenantSettings | null>(
        `/v1/settings/corporate-tenant?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&actedByUserId=${encodeURIComponent(session.userId)}`,
        null
      )
    : Promise.resolve(null);

  const [
    transactions,
    fileUploads,
    beneficiaries,
    approvalMatrices,
    roles,
    users,
    settings
  ] = await Promise.all([
    fetchApi<{ items: PayoutBatch[] }>(
      `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(selectedCorporateId)}`
    , { items: [] }),
    fetchApi<{ items: PayoutFileUpload[] }>(
      `/v1/payouts/file-uploads?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(selectedCorporateId)}`
    , { items: [] }),
    fetchApi<{ items: Beneficiary[] }>(
      `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(selectedCorporateId)}`
    , { items: [] }),
    fetchApi<{ items: ApprovalMatrix[] }>(
      `/v1/approval-matrices?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}`
    , { items: [] }),
    fetchApi<{ items: CorporateRole[] }>(
      `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}`
    , { items: [] }),
    fetchApi<{ items: CorporateUser[] }>(
      `/v1/auth/users?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(selectedCorporateId)}`
    , { items: [] }),
    settingsRequest
  ]);

  return {
    selectedCorporateId,
    bankTenants: bankTenants.items ?? [],
    corporateTenants: corporateTenants.items ?? [],
    corporates: availableCorporates,
    beneficiaries: beneficiaries.items ?? [],
    transactions: transactions.items ?? [],
    fileUploads: fileUploads.items ?? [],
    approvalMatrices: approvalMatrices.items ?? [],
    roles: roles.items ?? [],
    users: users.items ?? [],
    settings
  };
}

async function fetchApi<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function normalizeCookieValue(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
