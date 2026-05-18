import type { FastifyPluginAsync } from "fastify";

import {
  bankTenantCreateSchema,
  corporateCreateSchema,
  corporateTenantCreateSchema
} from "./contracts.js";
import { TenantManagementService } from "./service.js";

export const tenantManagementRoutes: FastifyPluginAsync = async (app) => {
  const tenantManagementService = new TenantManagementService();

  app.get("/v1/tenants/health", async () => {
    return {
      module: "tenant-management",
      status: "ready"
    };
  });

  app.get("/v1/tenants/banks", async () => {
    return {
      items: await tenantManagementService.listBankTenants()
    };
  });

  app.get("/v1/tenants/banks/:tenantId", async (request, reply) => {
    const params = request.params as { tenantId: string };
    const tenant = await tenantManagementService.getBankTenant(params.tenantId);

    if (!tenant) {
      return reply.status(404).send({
        message: "Bank tenant not found"
      });
    }

    return tenant;
  });

  app.post("/v1/tenants/banks", async (request, reply) => {
    const parsed = bankTenantCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid bank tenant payload",
        issues: parsed.error.flatten()
      });
    }

    return reply
      .status(201)
      .send(await tenantManagementService.createBankTenant(parsed.data));
  });

  app.get("/v1/tenants/corporates", async (request) => {
    const query = request.query as {
      bankTenantId?: string;
      status?: "draft" | "onboarding" | "active";
    };

    return {
      items: await tenantManagementService.listCorporateTenants(
        query.bankTenantId,
        query.status
      )
    };
  });

  app.get("/v1/tenants/corporates/:tenantId", async (request, reply) => {
    const params = request.params as { tenantId: string };
    const tenant = await tenantManagementService.getCorporateTenant(params.tenantId);

    if (!tenant) {
      return reply.status(404).send({
        message: "Corporate tenant not found"
      });
    }

    return tenant;
  });

  app.post("/v1/tenants/corporates", async (request, reply) => {
    const parsed = corporateTenantCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid corporate tenant payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await tenantManagementService.createCorporateTenant(parsed.data);

    if ("error" in result) {
      return reply.status(404).send({
        message: "Linked bank tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.get("/v1/corporates", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      status?: "draft" | "onboarding" | "active";
    };

    return {
      items: await tenantManagementService.listCorporates(
        query.corporateTenantId,
        query.status
      )
    };
  });

  app.get("/v1/corporates/:corporateId", async (request, reply) => {
    const params = request.params as { corporateId: string };
    const corporate = await tenantManagementService.getCorporate(params.corporateId);

    if (!corporate) {
      return reply.status(404).send({
        message: "Corporate not found"
      });
    }

    return corporate;
  });

  app.post("/v1/corporates", async (request, reply) => {
    const parsed = corporateCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid corporate payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await tenantManagementService.createCorporate(parsed.data);

    if ("error" in result) {
      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });
};
