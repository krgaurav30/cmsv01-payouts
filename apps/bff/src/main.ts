import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

import { loadConfig } from "@cmsv01/shared/config";
import { verifyJwt, signJwt } from "@cmsv01/shared/crypto";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((pair) => {
    const parts = pair.split("=");
    const key = parts[0].trim();
    if (key) {
      cookies[key] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return cookies;
}

function getVerifiedSessionHeaders(request: FastifyRequest): Record<string, string> | null {
  const cookies = parseCookies(request.headers.cookie);
  const sessionStr = cookies["cmsCorporateSession"];
  if (!sessionStr) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionStr);
    if (!session) {
      return null;
    }
    
    // Developer convenience fallback for pre-saved/legacy cookies
    if (!session.token && process.env.NODE_ENV !== "production") {
      session.token = signJwt(session);
    }
    
    if (!session.token) {
      return null;
    }
    
    const decoded = verifyJwt<Record<string, any>>(session.token);
    if (!decoded) {
      return null;
    }
    
    return {
      "Authorization": `Bearer ${session.token}`,
      "X-Bank-Tenant-ID": decoded.bankTenantId || "",
      "X-Corporate-Tenant-ID": decoded.corporateTenantId || "",
      "Content-Type": "application/json"
    };
  } catch {
    return null;
  }
}


type CorporateOperationsInitialData = {
  selectedCorporateId: string;
  bankTenants: unknown[];
  corporateTenants: unknown[];
  corporates: unknown[];
  subscriptions: unknown[];
  activeSubscription: {
    subscription: unknown;
    effectiveSettings: unknown | null;
  } | null;
  beneficiaries: unknown[];
  transactions: unknown[];
  fileUploads: unknown[];
  approvalMatrices: unknown[];
  roles: unknown[];
  users: unknown[];
  settings: unknown | null;
  debitAccounts: unknown[];
};

type OperationsInitialDataQuery = {
  bankTenantId?: string;
  corporateTenantId?: string;
  userId?: string;
  selectedCorporateId?: string;
  sessionCorporateId?: string;
  packageCode?: string;
  includeSettings?: string;
};

const config = loadConfig();
const app = Fastify({
  logger: {
    level: "info"
  }
});

app.decorateRequest("correlationId", "");

app.addHook("onRequest", async (request, reply) => {
  const correlationId = (request.headers["x-correlation-id"] as string) || `corr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  request.correlationId = correlationId;
  reply.header("X-Correlation-ID", correlationId);
});

const coreApiBase = resolveCoreApiBase();

app.get('/bff-debug', () => ({ coreApiBase, env: process.env.NODE_ENV }));
app.get('/health', async () => {
  const coreHealth = await fetchJson<Record<string, unknown>>("/health", {
    fallback: { status: "unreachable" }
  });

  return {
    status: "ok",
    app: `${config.appName} BFF`,
    coreApi: coreHealth
  };
});

app.post("/bff/auth/login", async (request, reply) => {
  try {
    const response = await fetch(`${coreApiBase}/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.body ?? {}),
      redirect: "manual"
    });

    reply.code(response.status);
    reply.header("content-type", response.headers.get("content-type") ?? "application/json");

    const buffer = Buffer.from(await response.arrayBuffer());
    return reply.send(buffer);
  } catch (error) {
    request.log.error(
      {
        err: error,
        body: request.body
      },
      "bff login proxy failed"
    );

    return reply.status(500).send({
      message: error instanceof Error ? error.message : "Unknown BFF login proxy failure"
    });
  }
});

app.get("/bff/corporate/operations/initial-data", async (request, reply) => {
  const secureHeaders = getVerifiedSessionHeaders(request);
  if (!secureHeaders) {
    return reply.status(401).send({ message: "Unauthorized" });
  }
  secureHeaders["X-Correlation-ID"] = request.correlationId;

  const query = request.query as OperationsInitialDataQuery;

  if (!query.bankTenantId || !query.corporateTenantId || !query.userId) {
    return reply.status(400).send({
      message:
        "bankTenantId, corporateTenantId, and userId are required to load operations data"
    });
  }

  const bankTenantsPromise = fetchJson<{ items?: unknown[] }>("/v1/tenants/banks", {
    fallback: { items: [] },
    headers: secureHeaders
  });
  const corporateTenantsPromise = fetchJson<{ items?: unknown[] }>(
    `/v1/tenants/corporates?status=active&bankTenantId=${encodeURIComponent(query.bankTenantId)}`,
    {
      fallback: { items: [] },
      headers: secureHeaders
    }
  );
  const corporatesPromise = fetchJson<{ items?: unknown[] }>(
    `/v1/corporates?status=active&corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
    {
      fallback: { items: [] },
      headers: secureHeaders
    }
  );

  const [bankTenants, corporateTenants, corporates] = await Promise.all([
    bankTenantsPromise,
    corporateTenantsPromise,
    corporatesPromise
  ]);

  const availableCorporates = corporates.items ?? [];
  const selectedCorporateId =
    normalizeQueryValue(query.selectedCorporateId) ??
    normalizeQueryValue(query.sessionCorporateId) ??
    getFirstCorporateId(availableCorporates);

  if (!selectedCorporateId) {
    const response: CorporateOperationsInitialData = {
      selectedCorporateId: "",
      bankTenants: bankTenants.items ?? [],
      corporateTenants: corporateTenants.items ?? [],
      corporates: availableCorporates,
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
    };

    return reply.send(response);
  }

  const includeSettings = query.includeSettings === "true";
  const settingsPath = `/v1/settings/corporate-tenant?corporateTenantId=${encodeURIComponent(
    query.corporateTenantId
  )}&actedByUserId=${encodeURIComponent(query.userId)}`;
  const subscriptionsPath = new URLSearchParams({
    corporateTenantId: query.corporateTenantId,
    corporateId: selectedCorporateId,
    status: "active"
  });

  const packageCode = normalizeQueryValue(query.packageCode);
  if (packageCode) {
    subscriptionsPath.set("packageCode", packageCode);
  }

  const [
    transactions,
    fileUploads,
    beneficiaries,
    approvalMatrices,
    roles,
    users,
    settings,
    subscriptions,
    debitAccounts
  ] = await Promise.all([
    fetchJson<{ items?: unknown[] }>(
      `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/payouts/file-uploads?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/approval-matrices?corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/auth/users?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    includeSettings
      ? fetchJson<unknown | null>(settingsPath, {
          fallback: null,
          headers: secureHeaders
        })
      : Promise.resolve(null),
    fetchJson<{ items?: unknown[] }>(`/v1/subscriptions?${subscriptionsPath.toString()}`, {
      fallback: { items: [] },
      headers: secureHeaders
    }),
    fetchJson<{ items?: unknown[] }>(
      `/v1/debit-accounts?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    )
  ]);

  const availableSubscriptions = subscriptions.items ?? [];
  const selectedSubscription = selectSubscription(availableSubscriptions, packageCode);
  const selectedSubscriptionId = selectedSubscription
    ? getSubscriptionId(selectedSubscription)
    : "";
  const activeSubscription = selectedSubscription
    && selectedSubscriptionId
    ? {
        subscription: selectedSubscription,
        effectiveSettings: await fetchJson<unknown | null>(
          `/v1/effective-settings/subscriptions/${encodeURIComponent(selectedSubscriptionId)}`,
          {
            fallback: null,
            headers: secureHeaders
          }
        )
      }
    : null;

  const response: CorporateOperationsInitialData = {
    selectedCorporateId,
    bankTenants: bankTenants.items ?? [],
    corporateTenants: corporateTenants.items ?? [],
    corporates: availableCorporates,
    subscriptions: availableSubscriptions,
    activeSubscription,
    beneficiaries: beneficiaries.items ?? [],
    transactions: transactions.items ?? [],
    fileUploads: fileUploads.items ?? [],
    approvalMatrices: approvalMatrices.items ?? [],
    roles: roles.items ?? [],
    users: users.items ?? [],
    settings,
    debitAccounts: debitAccounts.items ?? []
  };

  return reply.send(response);
});

app.all("/v1/*", async (request, reply) => {
  return proxyToCore(request, reply, request.url);
});

app.all("/bank/*", async (request, reply) => {
  return proxyToCore(request, reply, request.url);
});

async function proxyToCore(request: FastifyRequest, reply: FastifyReply, path: string) {
  let headers: Record<string, string> = {};
  let body: unknown;
  try {
    const cleanPath = path.split("?")[0];
    const isPublic =
      cleanPath === "/health" ||
      cleanPath === "/context" ||
      cleanPath === "/v1/auth/login" ||
      cleanPath === "/bff/auth/login";

    let secureHeaders: Record<string, string> | null = null;
    if (!isPublic) {
      secureHeaders = getVerifiedSessionHeaders(request);
      if (!secureHeaders) {
        return reply.status(401).send({ message: "Unauthorized" });
      }
    }

    headers = buildProxyHeaders(request);
    headers["X-Correlation-ID"] = request.correlationId;

    if (secureHeaders) {
      // Strip client-submitted tenant and auth headers to prevent spoofing
      for (const key of Object.keys(headers)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === "x-bank-tenant-id" ||
          lowerKey === "x-corporate-tenant-id" ||
          lowerKey === "authorization"
        ) {
          delete headers[key];
        }
      }

      // Re-inject verified tenant and auth headers
      headers["Authorization"] = secureHeaders["Authorization"];
      headers["X-Bank-Tenant-ID"] = secureHeaders["X-Bank-Tenant-ID"];
      headers["X-Corporate-Tenant-ID"] = secureHeaders["X-Corporate-Tenant-ID"];
    }

    body = buildProxyBody(request);
    
    const response = await fetch(`${coreApiBase}${path}`, {
      method: request.method,
      headers,
      body: body as any,
      redirect: "manual"
    });

    reply.code(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") {
        return;
      }
      reply.header(key, value);
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return reply.send(buffer);
  } catch (error: any) {
    return reply.status(500).send({ 
      error: String(error), 
      stack: error?.stack, 
      cause: error?.cause,
      debugArgs: { url: `${coreApiBase}${path}`, method: request.method, headers, bodyType: typeof body }
    });
  }
}
function buildProxyHeaders(request: FastifyRequest) {
  const headers: Record<string, string> = {};

  Object.entries(request.headers).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (["host", "connection", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      return;
    }

    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
      return;
    }

    headers[key] = value;
  });

  return headers;
}

function buildProxyBody(request: FastifyRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body;
  }

  if (request.body === undefined || request.body === null) {
    return undefined;
  }

  return JSON.stringify(request.body);
}

async function fetchJson<T>(path: string, options: { fallback: T; headers?: Record<string, string> }): Promise<T> {
  try {
    const response = await fetch(`${coreApiBase}${path}`, {
      cache: "no-store",
      headers: options.headers
    });

    if (!response.ok) {
      return options.fallback;
    }

    return (await response.json()) as T;
  } catch {
    return options.fallback;
  }
}

function getFirstCorporateId(items: unknown[]) {
  const first = items[0] as { corporateId?: string } | undefined;
  return first?.corporateId ?? "";
}

function selectSubscription(items: unknown[], preferredPackageCode?: string | null) {
  if (items.length === 0) {
    return null;
  }

  if (preferredPackageCode) {
    const matching = items.find((item) => {
      const entry = item as { packageCode?: string } | undefined;
      return entry?.packageCode === preferredPackageCode;
    });

    if (matching) {
      return matching;
    }
  }

  return items[0] ?? null;
}

function getSubscriptionId(item: unknown) {
  const entry = item as { subscriptionId?: string } | undefined;
  return entry?.subscriptionId ?? "";
}

function normalizeQueryValue(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveCoreApiBase() {
  const configured =
    process.env.CORE_API_URL ||
    process.env.API_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3101" : null);

  if (!configured) {
    throw new Error(
      "Core API base URL is not configured. Set CORE_API_URL for the BFF runtime."
    );
  }

  return configured.replace(/\/+$/, "");
}

try {
  await app.listen({
    host: "0.0.0.0",
    port: config.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
