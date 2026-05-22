import type { FastifyPluginAsync } from "fastify";

import { EffectiveSettingsResolverService } from "./service.js";

export const effectiveSettingsResolverRoutes: FastifyPluginAsync = async (app) => {
  const effectiveSettingsResolverService = new EffectiveSettingsResolverService();

  app.get("/v1/effective-settings/health", async () => {
    return {
      module: "effective-settings-resolver",
      status: "ready"
    };
  });

  app.get("/v1/effective-settings/resolve", async (request, reply) => {
    const query = request.query as { corporateId?: string; packageCode?: string };

    if (!query.corporateId || !query.packageCode) {
      return reply.status(400).send({
        message: "corporateId and packageCode are required"
      });
    }

    const result = await effectiveSettingsResolverService.resolveForCorporatePackage(
      query.corporateId,
      query.packageCode
    );

    if ("error" in result) {
      return reply.status(404).send({
        message:
          result.error === "package_not_found"
            ? "Package not found"
            : "Active subscription not found"
      });
    }

    return result.data;
  });

  app.get(
    "/v1/effective-settings/subscriptions/:subscriptionId",
    async (request, reply) => {
      const params = request.params as { subscriptionId: string };
      const result = await effectiveSettingsResolverService.resolveForSubscription(
        params.subscriptionId
      );

      if ("error" in result) {
        return reply.status(404).send({
          message:
            result.error === "package_not_found"
              ? "Package not found"
              : "Subscription not found"
        });
      }

      return result.data;
    }
  );
};
