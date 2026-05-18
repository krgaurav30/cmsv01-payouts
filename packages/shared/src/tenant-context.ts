import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

type TenantContext = {
  bankTenantId: string | null;
  corporateTenantId: string | null;
  source: "header" | "none";
};

const defaultTenantContext: TenantContext = {
  bankTenantId: null,
  corporateTenantId: null,
  source: "none"
};

declare module "fastify" {
  interface FastifyRequest {
    _tenantContext: TenantContext | null;
    tenantContext: TenantContext;
  }
}

const tenantContextPluginImpl: FastifyPluginAsync = async (app) => {
  app.decorateRequest("_tenantContext", null);
  app.decorateRequest("tenantContext", {
    getter(this: { _tenantContext: TenantContext | null }) {
      return this._tenantContext ?? defaultTenantContext;
    },
    setter(this: { _tenantContext: TenantContext | null }, value: TenantContext) {
      this._tenantContext = value;
    }
  });

  app.addHook("onRequest", async (request) => {
    const bankTenantId = request.headers["x-bank-tenant-id"];
    const corporateTenantId = request.headers["x-corporate-tenant-id"];

    request.tenantContext = {
      bankTenantId:
        typeof bankTenantId === "string" && bankTenantId.length > 0
          ? bankTenantId
          : null,
      corporateTenantId:
        typeof corporateTenantId === "string" && corporateTenantId.length > 0
          ? corporateTenantId
          : null,
      source:
        typeof bankTenantId === "string" || typeof corporateTenantId === "string"
          ? "header"
          : "none"
    };
  });
};

export const tenantContextPlugin = fp(tenantContextPluginImpl, {
  name: "tenant-context"
});
