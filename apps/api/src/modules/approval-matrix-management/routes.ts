import type { FastifyPluginAsync } from "fastify";

import { approvalMatrixCreateSchema } from "./contracts.js";
import { ApprovalMatrixManagementService } from "./service.js";

export const approvalMatrixManagementRoutes: FastifyPluginAsync = async (app) => {
  const approvalMatrixManagementService = new ApprovalMatrixManagementService();

  app.get("/v1/approval-matrices", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
    };

    return {
      items: await approvalMatrixManagementService.listMatrices(query.corporateTenantId)
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

      return reply.status(409).send({
        message:
          result.error === "invalid_roles"
            ? `These roles are not approved transaction checker roles: ${result.roles.join(", ")}`
            : "Invalid approval matrix configuration"
      });
    }

    return reply.status(201).send(result.data);
  });
};
