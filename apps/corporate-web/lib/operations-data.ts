import type { CorporateSession, OperationsInitialData } from "./types";
import { resolveBffBase } from "./api-base";

export async function loadOperationsInitialData(
  session: CorporateSession,
  selectedCorporateCookieValue?: string | null,
  requestOrigin?: string | null
): Promise<OperationsInitialData> {
  const bffBase = resolveBffBase(requestOrigin);
  const query = new URLSearchParams({
    bankTenantId: session.bankTenantId,
    corporateTenantId: session.corporateTenantId,
    userId: session.userId,
    sessionCorporateId: session.corporateId ?? "",
    selectedCorporateId: normalizeCookieValue(selectedCorporateCookieValue) ?? "",
    includeSettings: String(session.permissions.includes("settings.view"))
  });

  return fetchApi<OperationsInitialData>(
    bffBase,
    `/bff/corporate/operations/initial-data?${query.toString()}`,
    {
      selectedCorporateId: "",
      bankTenants: [],
      corporateTenants: [],
      corporates: [],
      subscriptions: [],
      activeSubscription: null,
      beneficiaries: [],
      transactions: [],
      fileUploads: [],
      approvalMatrices: [],
      roles: [],
      users: [],
      settings: null,
      debitAccounts: []
    }
  );
}

async function fetchApi<T>(apiBase: string, path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
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
