import type { FastifyPluginAsync } from "fastify";

import {
  subscriptionCreateSchema,
  subscriptionRoleAccessUpdateSchema,
  subscriptionStatusUpdateSchema
} from "./contracts.js";
import { SubscriptionManagementService } from "./service.js";

export const subscriptionManagementRoutes: FastifyPluginAsync = async (app) => {
  const subscriptionManagementService = new SubscriptionManagementService();

  app.get("/v1/subscriptions/health", async () => {
    return {
      module: "subscription-management",
      status: "ready"
    };
  });

  app.get("/v1/subscriptions", async (request) => {
    const query = request.query as {
      corporateId?: string;
      corporateTenantId?: string;
      packageCode?: string;
      status?: "draft" | "active" | "suspended" | "terminated";
      userId?: string;
    };

    return {
      items: await subscriptionManagementService.listSubscriptions(query)
    };
  });

  app.get("/v1/subscriptions/:subscriptionId", async (request, reply) => {
    const params = request.params as { subscriptionId: string };
    const entry = await subscriptionManagementService.getSubscription(params.subscriptionId);

    if (!entry) {
      return reply.status(404).send({
        message: "Subscription not found"
      });
    }

    return entry;
  });

  app.post("/v1/subscriptions", async (request, reply) => {
    const parsed = subscriptionCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Invalid subscription payload"
      });
    }

    try {
      const entry = await subscriptionManagementService.createSubscription(parsed.data);

      if (!entry) {
        return reply.status(500).send({
          message: "Subscription could not be created"
        });
      }

      return reply.status(201).send(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Subscription could not be created";
      const statusCode =
        message === "Package not found"
          ? 404
          : message === "This package is already active in the current workspace"
            ? 409
            : 400;

      return reply.status(statusCode).send({ message });
    }
  });

  app.put("/v1/subscriptions/:subscriptionId/status", async (request, reply) => {
    const params = request.params as { subscriptionId: string };
    const parsed = subscriptionStatusUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Invalid subscription status payload"
      });
    }

    const entry = await subscriptionManagementService.updateSubscriptionStatus(
      params.subscriptionId,
      parsed.data
    );

    if (!entry) {
      return reply.status(404).send({
        message: "Subscription not found"
      });
    }

    return entry;
  });

  app.put("/v1/subscriptions/role-access", async (request, reply) => {
    const parsed = subscriptionRoleAccessUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Invalid subscription role-access payload"
      });
    }

    try {
      const result = await subscriptionManagementService.replaceRoleSubscriptionAccess(parsed.data);

      if ("error" in result) {
        if (result.error === "role_not_found") {
          return reply.status(404).send({ message: "Role not found" });
        }

        return reply.status(403).send({ message: "You do not have access to update role packages" });
      }

      return { items: result.data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Role package access could not be updated";
      return reply.status(400).send({ message });
    }
  });
};
