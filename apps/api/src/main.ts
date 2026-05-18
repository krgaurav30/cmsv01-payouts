import Fastify from "fastify";

import { loadConfig } from "@cmsv01/shared/config";
import { testDatabaseConnection } from "@cmsv01/shared/db";
import { tenantContextPlugin } from "@cmsv01/shared/tenant-context";

import { approvalMatrixManagementRoutes } from "./modules/approval-matrix-management/routes.js";
import { bankAppRoutes } from "./modules/bank-app/routes.js";
import { beneficiaryManagementRoutes } from "./modules/beneficiary-management/routes.js";
import { corporateAppRoutes } from "./modules/corporate-app/routes.js";
import { corporateOnboardingRoutes } from "./modules/corporate-onboarding/routes.js";
import { identityAccessRoutes } from "./modules/identity-access/routes.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";
import { payoutManagementRoutes } from "./modules/payout-management/routes.js";
import { settingsManagementRoutes } from "./modules/settings-management/routes.js";
import { tenantManagementRoutes } from "./modules/tenant-management/routes.js";
import { testConsoleRoutes } from "./modules/test-console/routes.js";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: "info"
  }
});

await testDatabaseConnection(config);
await app.register(tenantContextPlugin);
await app.register(approvalMatrixManagementRoutes);
await app.register(bankAppRoutes);
await app.register(beneficiaryManagementRoutes);
await app.register(corporateAppRoutes);
await app.register(corporateOnboardingRoutes);
await app.register(identityAccessRoutes);
await app.register(notificationsRoutes);
await app.register(payoutManagementRoutes);
await app.register(settingsManagementRoutes);
await app.register(tenantManagementRoutes);
await app.register(testConsoleRoutes);

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
    host: "127.0.0.1",
    port: config.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
