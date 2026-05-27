import Fastify from "fastify";
import { randomUUID } from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
    responseBody?: any;
  }
}

import { loadConfig } from "@cmsv01/shared/config";
import { testDatabaseConnection } from "@cmsv01/shared/db";
import { tenantContextPlugin } from "@cmsv01/shared/tenant-context";
import { jwtAuthPlugin } from "./modules/identity-access/jwt-auth.js";
import { PartnerApiActivityService } from "./modules/partner-api-activity/service.js";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { approvalMatrixManagementRoutes } from "./modules/approval-matrix-management/routes.js";
import { debitAccountManagementRoutes } from "./modules/debit-account-management/routes.js";
import { effectiveSettingsResolverRoutes } from "./modules/effective-settings-resolver/routes.js";
import { bankAppRoutes } from "./modules/bank-app/routes.js";
import { beneficiaryManagementRoutes } from "./modules/beneficiary-management/routes.js";
import { corporateOnboardingRoutes } from "./modules/corporate-onboarding/routes.js";
import { identityAccessRoutes } from "./modules/identity-access/routes.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";
import { packageCatalogRoutes } from "./modules/package-catalog/routes.js";
import { payoutManagementRoutes } from "./modules/payout-management/routes.js";
import { settingsManagementRoutes } from "./modules/settings-management/routes.js";
import { subscriptionManagementRoutes } from "./modules/subscription-management/routes.js";
import { tenantManagementRoutes } from "./modules/tenant-management/routes.js";
import { testConsoleRoutes } from "./modules/test-console/routes.js";
import { cbsSimulatorRoutes } from "./modules/cbs-simulator/routes.js";

import { registerCheckoutSessionRoutes } from "./modules/checkout-sessions/routes.js";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: "info",
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          correlationId: request.correlationId
        };
      }
    }
  }
});

app.decorateRequest("correlationId", "");
app.decorateRequest("responseBody", undefined);

app.addHook("onRequest", async (request, reply) => {
  const correlationId = (request.headers["x-correlation-id"] as string) || `corr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  request.correlationId = correlationId;
  reply.header("X-Correlation-ID", correlationId);
});

// Capture response body payload for partner APIs
app.addHook("onSend", async (request, reply, payload) => {
  const path = request.raw.url || "";
  if (path.startsWith("/v1/partner/") || path.startsWith("/v1/checkout/sessions/")) {
    request.responseBody = payload;
  }
  return payload;
});

// Record API activity asynchronously after sending the response
app.addHook("onResponse", async (request, reply) => {
  const path = request.raw.url || "";
  const isPartnerRoute = path.startsWith("/v1/partner/");
  const isCheckoutPayRoute = path.startsWith("/v1/checkout/sessions/") && path.endsWith("/pay");

  if (isPartnerRoute || isCheckoutPayRoute) {
    let category: "beneficiary" | "payment" = "payment";
    let apiName = "API Call";

    if (path.includes("/beneficiaries")) {
      category = "beneficiary";
      if (path.endsWith("/authorize")) {
        apiName = "Authorize Beneficiary";
      } else {
        apiName = "Create Beneficiary";
      }
    } else if (path.includes("/payments/transactions")) {
      category = "payment";
      if (path.endsWith("/authorize")) {
        apiName = "Authorize Payment";
      } else if (path.endsWith("/status")) {
        apiName = "Get Transaction Status";
      } else {
        apiName = "Make Payment";
      }
    } else if (path.includes("/partner/checkout/sessions")) {
      category = "payment";
      apiName = "Create Checkout Session";
    } else if (isCheckoutPayRoute) {
      category = "payment";
      apiName = "Pay Checkout Session";
    }

    let responseBodyParsed: any = null;
    if (request.responseBody) {
      try {
        if (typeof request.responseBody === "string") {
          responseBodyParsed = JSON.parse(request.responseBody);
        } else if (Buffer.isBuffer(request.responseBody)) {
          responseBodyParsed = JSON.parse(request.responseBody.toString("utf-8"));
        }
      } catch {
        responseBodyParsed = request.responseBody;
      }
    }

    const activityService = new PartnerApiActivityService();
    await activityService.logActivity({
      activityId: request.correlationId,
      category,
      apiName,
      method: request.method,
      path,
      requestHeaders: request.headers,
      requestBody: request.body,
      responseStatus: reply.statusCode,
      responseHeaders: reply.getHeaders(),
      responseBody: responseBodyParsed,
      ipAddress: request.ip
    });
  }
});

await testDatabaseConnection(config);

function isValidOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (config.nodeEnv !== "production") {
    return true;
  }
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;

    // Check if localhost/loopback
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    const allowedHostnames = new Set([
      "cmsv01-corporate.onrender.com",
      "cmsv01-bank-ops.onrender.com"
    ]);

    if (process.env.BFF_URL) {
      try {
        allowedHostnames.add(new URL(process.env.BFF_URL).hostname);
      } catch {}
    }
    if (process.env.CORPORATE_WEB_URL) {
      try {
        allowedHostnames.add(new URL(process.env.CORPORATE_WEB_URL).hostname);
      } catch {}
    }
    if (process.env.BANK_OPS_WEB_URL) {
      try {
        allowedHostnames.add(new URL(process.env.BANK_OPS_WEB_URL).hostname);
      } catch {}
    }

    return allowedHostnames.has(hostname);
  } catch {
    return false;
  }
}

await app.register(helmet);
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (isValidOrigin(origin)) {
      cb(null, true);
    } else {
      cb(new Error("CORS policy violation"), false);
    }
  },
  credentials: true
});
await app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute"
});

await app.register(tenantContextPlugin);
await app.register(jwtAuthPlugin);
await app.register(approvalMatrixManagementRoutes);
await app.register(debitAccountManagementRoutes);
await app.register(effectiveSettingsResolverRoutes);
await app.register(bankAppRoutes);
await app.register(beneficiaryManagementRoutes);
await app.register(corporateOnboardingRoutes);
await app.register(identityAccessRoutes);
await app.register(notificationsRoutes);
await app.register(packageCatalogRoutes);
await app.register(payoutManagementRoutes);
await app.register(settingsManagementRoutes);
await app.register(subscriptionManagementRoutes);
await app.register(tenantManagementRoutes);
await app.register(cbsSimulatorRoutes);
await app.register(registerCheckoutSessionRoutes);
if (config.nodeEnv !== "production") {
  await app.register(testConsoleRoutes);
}

app.get("/health", async () => {
  return {
    status: "ok",
    app: config.appName
  };
});

app.get("/context", async (request) => {
  return {
    app: config.appName,
    tenant: request.tenantContext
  };
});

try {
  await app.listen({
    host: "0.0.0.0",
    port: config.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, starting graceful shutdown...`);
    try {
      await app.close();
      app.log.info("Server closed successfully.");
      process.exit(0);
    } catch (err) {
      app.log.error(err instanceof Error ? err : new Error(String(err)), "Error during graceful shutdown");
      process.exit(1);
    }
  });
}
