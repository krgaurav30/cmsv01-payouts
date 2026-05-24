import Fastify from "fastify";
import { randomUUID } from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

import { loadConfig } from "@cmsv01/shared/config";
import { testDatabaseConnection } from "@cmsv01/shared/db";
import { tenantContextPlugin } from "@cmsv01/shared/tenant-context";
import { jwtAuthPlugin } from "./modules/identity-access/jwt-auth.js";

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

app.addHook("onRequest", async (request, reply) => {
  const correlationId = (request.headers["x-correlation-id"] as string) || `corr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  request.correlationId = correlationId;
  reply.header("X-Correlation-ID", correlationId);
});

await testDatabaseConnection(config);
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
