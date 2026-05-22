import type { FastifyPluginAsync } from "fastify";

import {
  packageCreateSchema,
  packageUpdateSchema,
  paymentMethodCreateSchema,
  paymentMethodUpdateSchema
} from "./contracts.js";
import { PackageCatalogService } from "./service.js";

export const packageCatalogRoutes: FastifyPluginAsync = async (app) => {
  const packageCatalogService = new PackageCatalogService();

  app.get("/v1/package-catalog/health", async () => {
    return {
      module: "package-catalog",
      status: "ready"
    };
  });

  app.get("/v1/package-catalog/payment-methods", async (request) => {
    const query = request.query as { status?: "active" | "inactive" };

    return {
      items: await packageCatalogService.listPaymentMethods(query.status)
    };
  });

  app.post("/v1/package-catalog/payment-methods", async (request, reply) => {
    const parsed = paymentMethodCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payment method payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await packageCatalogService.createPaymentMethod(parsed.data);

    if (!("data" in result)) {
      return reply.status(409).send({
        message: `Payment method already exists: ${result.paymentMethodCode}`
      });
    }

    return reply.status(201).send(result.data);
  });

  app.put("/v1/package-catalog/payment-methods/:paymentMethodCode", async (request, reply) => {
    const params = request.params as { paymentMethodCode: string };
    const parsed = paymentMethodUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payment method payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await packageCatalogService.updatePaymentMethod(
      params.paymentMethodCode,
      parsed.data
    );

    if (!("data" in result)) {
      return reply.status(404).send({
        message: "Payment method not found"
      });
    }

    return result.data;
  });

  app.get("/v1/package-catalog/packages", async (request) => {
    const query = request.query as {
      ownerType?: "bank" | "corporate";
      bankTenantId?: string;
      corporateTenantId?: string;
      corporateId?: string;
      status?: "active" | "inactive";
    };

    return {
      items: await packageCatalogService.listPackages({
        ownerType: query.ownerType,
        bankTenantId: query.bankTenantId,
        corporateTenantId: query.corporateTenantId,
        corporateId: query.corporateId,
        status: query.status
      })
    };
  });

  app.post("/v1/package-catalog/packages", async (request, reply) => {
    const parsed = packageCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid package payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await packageCatalogService.createPackage(parsed.data);

    if (!("data" in result)) {
      return reply.status(result.error === "package_exists" ? 409 : 404).send({
        message:
          result.error === "package_exists"
            ? `Package already exists: ${result.packageCode}`
            : result.error === "debit_account_not_found"
              ? "One or more selected debit accounts were not found"
              : "One or more selected payment methods were not found"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.get("/v1/package-catalog/packages/:packageCode", async (request, reply) => {
    const params = request.params as { packageCode: string };
    const query = request.query as {
      ownerType?: "bank" | "corporate";
      bankTenantId?: string;
      corporateId?: string;
    };
    const entry = await packageCatalogService.getPackageByCode(params.packageCode, {
      ownerType: query.ownerType,
      bankTenantId: query.bankTenantId,
      corporateId: query.corporateId
    });

    if (!entry) {
      return reply.status(404).send({
        message: "Package not found"
      });
    }

    return entry;
  });

  app.put("/v1/package-catalog/packages/by-id/:packageId", async (request, reply) => {
    const params = request.params as { packageId: string };
    const parsed = packageUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid package payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await packageCatalogService.updatePackage(params.packageId, parsed.data);

    if (!("data" in result)) {
      return reply.status(result.error === "package_not_found" ? 404 : 404).send({
        message:
          result.error === "package_not_found"
            ? "Package not found"
            : result.error === "debit_account_not_found"
              ? "One or more selected debit accounts were not found"
              : "One or more selected payment methods were not found"
      });
    }

    return result.data;
  });
};
