import type { FastifyPluginAsync } from "fastify";

import { approvalMatrixCreateSchema, approvalMatrixUpdateSchema } from "./contracts.js";
import { ApprovalMatrixManagementService } from "./service.js";

export const approvalMatrixManagementRoutes: FastifyPluginAsync = async (app) => {
  const approvalMatrixManagementService = new ApprovalMatrixManagementService();

  app.get("/v1/approval-matrices", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      subscriptionId?: string;
    };

    return {
      items: await approvalMatrixManagementService.listMatrices(
        query.corporateTenantId,
        query.subscriptionId
      )
    };
  });

  app.post("/v1/approval-matrices", async (request, reply) => {
    const parsed = approvalMatrixCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid approval matrix payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await approvalMatrixManagementService.createMatrix(parsed.data);

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can create approval matrices"
        });
      }

      if (result.error === "invalid_amount_range") {
        return reply.status(409).send({
          message: "To Amount must be greater than or equal to From Amount"
        });
      }

      if (result.error === "subscription_access_forbidden") {
        return reply.status(403).send({
          message: "You do not have access to manage approval rules for this package subscription"
        });
      }

      if (result.error === "invalid_debit_accounts") {
        return reply.status(409).send({
          message: "Select debit accounts that are active for the chosen package"
        });
      }

      if (result.error === "roles_missing_debit_account_access") {
        return reply.status(409).send({
          message: `These roles do not have access to all selected debit accounts: ${result.roles.join(", ")}`
        });
      }

      return reply.status(409).send({
        message:
          result.error === "invalid_roles"
            ? `These roles are not approved transaction checker roles: ${result.roles.join(", ")}`
            : "Invalid approval matrix configuration"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.put("/v1/approval-matrices/:matrixId", async (request, reply) => {
    const params = request.params as { matrixId: string };
    const parsed = approvalMatrixUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid approval matrix payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await approvalMatrixManagementService.updateMatrix(
      params.matrixId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "matrix_not_found") {
        return reply.status(404).send({
          message: "Approval matrix not found"
        });
      }

      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can update approval matrices"
        });
      }

      if (result.error === "invalid_amount_range") {
        return reply.status(409).send({
          message: "To Amount must be greater than or equal to From Amount"
        });
      }

      if (result.error === "subscription_access_forbidden") {
        return reply.status(403).send({
          message: "You do not have access to manage approval rules for this package subscription"
        });
      }

      if (result.error === "invalid_debit_accounts") {
        return reply.status(409).send({
          message: "Select debit accounts that are active for the chosen package"
        });
      }

      if (result.error === "roles_missing_debit_account_access") {
        return reply.status(409).send({
          message: `These roles do not have access to all selected debit accounts: ${result.roles.join(", ")}`
        });
      }

      return reply.status(409).send({
        message:
          result.error === "invalid_roles"
            ? `These roles are not approved transaction checker roles: ${result.roles.join(", ")}`
            : "Invalid approval matrix configuration"
      });
    }

    return result.data;
  });
};
