import type { FastifyPluginAsync } from "fastify";

import { corporateTenantSettingsSchema } from "./contracts.js";
import { SettingsManagementService } from "./service.js";

export const settingsManagementRoutes: FastifyPluginAsync = async (app) => {
  const settingsManagementService = new SettingsManagementService();

  app.get("/v1/settings/health", async () => {
    return {
      module: "settings-management",
      status: "ready"
    };
  });

  app.get("/v1/settings/corporate-tenant", async (request, reply) => {
    const query = request.query as {
      corporateTenantId?: string;
      actedByUserId?: string;
    };

    if (!query.corporateTenantId || !query.actedByUserId) {
      return reply.status(400).send({
        message: "corporateTenantId and actedByUserId are required"
      });
    }

    const result = await settingsManagementService.getSettingsForView(
      query.corporateTenantId,
      query.actedByUserId
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "You do not have permission to view settings"
        });
      }

      return reply.status(404).send({
        message: "Corporate tenant not found"
      });
    }

    return result.data;
  });

  app.post("/v1/settings/corporate-tenant", async (request, reply) => {
    const parsed = corporateTenantSettingsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid settings payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await settingsManagementService.upsertSettings(parsed.data);

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "You do not have permission to edit settings"
        });
      }

      return reply.status(404).send({
        message: "Corporate tenant not found"
      });
    }

    return result.data;
  });
};
