import type { FastifyPluginAsync } from "fastify";

import {
  debitAccountCreateSchema,
  debitAccountUpdateSchema,
  subscriptionDebitAccountAccessUpdateSchema
} from "./contracts.js";
import { DebitAccountManagementService } from "./service.js";

export const debitAccountManagementRoutes: FastifyPluginAsync = async (app) => {
  const service = new DebitAccountManagementService();

  app.get("/v1/debit-accounts", async (request) => {
    const query = request.query as {
      bankTenantId?: string;
      corporateTenantId?: string;
      corporateId?: string;
      status?: "active" | "inactive";
    };

    return {
      items: await service.listCorporateDebitAccounts(query)
    };
  });

  app.post("/v1/debit-accounts", async (request, reply) => {
    const parsed = debitAccountCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid debit account payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await service.createDebitAccount(parsed.data);
    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({ message: "You do not have access to manage debit accounts." });
      }

      return reply.status(409).send({
        message: "This account number already exists for the selected corporate."
      });
    }

    return reply.status(201).send(result.data);
  });

  app.put("/v1/debit-accounts/:debitAccountId", async (request, reply) => {
    const params = request.params as { debitAccountId: string };
    const parsed = debitAccountUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid debit account payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await service.updateDebitAccount(params.debitAccountId, parsed.data);
    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({ message: "You do not have access to manage debit accounts." });
      }

      if (result.error === "debit_account_not_found") {
        return reply.status(404).send({ message: "Debit account not found." });
      }

      return reply.status(409).send({
        message: "This account number already exists for the selected corporate."
      });
    }

    return result.data;
  });

  app.put("/v1/subscriptions/:subscriptionId/debit-accounts", async (request, reply) => {
    const params = request.params as { subscriptionId: string };
    const parsed = subscriptionDebitAccountAccessUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid subscription debit-account payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await service.updateSubscriptionDebitAccountAccess(
      params.subscriptionId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({ message: "You do not have access to manage package debit accounts." });
      }

      if (result.error === "subscription_not_found") {
        return reply.status(404).send({ message: "Workspace package not found." });
      }

      if (result.error === "default_account_not_allowed") {
        return reply.status(409).send({
          message: "The default account must be one of the selected allowed accounts."
        });
      }

      return reply.status(404).send({
        message: "One or more selected debit accounts could not be found for this corporate."
      });
    }

    return { success: true };
  });
};
