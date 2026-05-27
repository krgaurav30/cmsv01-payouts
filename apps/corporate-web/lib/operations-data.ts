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

  const cookieHeader = `cmsCorporateSession=${encodeURIComponent(JSON.stringify(session))}${
    selectedCorporateCookieValue ? `; cmsSelectedCorporateId=${encodeURIComponent(selectedCorporateCookieValue)}` : ""
  }`;

  const startTime = Date.now();
  const url = `/bff/corporate/operations/initial-data?${query.toString()}`;
  console.log(`[SSR] Fetching initial data: ${bffBase}${url}`);

  try {
    const result = await fetchApi<OperationsInitialData>(
      bffBase,
      url,
      cookieHeader,
      {
        selectedCorporateId: normalizeCookieValue(selectedCorporateCookieValue) ?? "",
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
    console.log(`[SSR] Initial data fetch completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (err: any) {
    console.error(`[SSR] Initial data fetch failed after ${Date.now() - startTime}ms:`, err.message);
    throw err;
  }
}

async function fetchApi<T>(apiBase: string, path: string, cookieHeader: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      headers: {
        "Cookie": cookieHeader
      }
    });

    if (response.status === 401) {
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      throw err;
    }
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

