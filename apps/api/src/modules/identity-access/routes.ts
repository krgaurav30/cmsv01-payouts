import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "@cmsv01/shared/config";

import {
  approvalActionSchema,
  corporateRoleCreateSchema,
  corporateUserCreateSchema,
  loginRequestSchema
} from "./contracts.js";
import { IdentityAccessService } from "./service.js";

export const identityAccessRoutes: FastifyPluginAsync = async (app) => {
  const config = loadConfig();
  const identityAccessService = new IdentityAccessService(config);

  app.get("/v1/auth/health", async () => {
    return {
      module: "identity-access",
      status: "ready",
      authMode: "built-in",
      databaseConfigured: Boolean(config.databaseUrl)
    };
  });

  app.get("/v1/auth/roles", async () => {
    return {
      roles: identityAccessService.getSupportedRoles()
    };
  });

  app.get("/v1/auth/corporate-roles", async (request) => {
    const query = request.query as { corporateTenantId?: string };

    return {
      items: await identityAccessService.listCorporateRoles(query.corporateTenantId)
    };
  });

  app.get("/v1/auth/users", async (request) => {
    const query = request.query as { corporateTenantId?: string; corporateId?: string };

    return {
      items: await identityAccessService.listCorporateUsers(
        query.corporateTenantId,
        query.corporateId
      )
    };
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid login payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.login(parsed.data);

    if ("error" in result) {
      return reply.status(401).send({
        message: "Invalid username or password"
      });
    }

    return result.data;
  });

  app.post("/v1/auth/users", async (request, reply) => {
    const parsed = corporateUserCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid corporate user payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.createCorporateUser(parsed.data);
    if ("error" in result) {
      return reply.status(403).send({
        message: "Only an approved maker can create users"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/auth/corporate-roles", async (request, reply) => {
    const parsed = corporateRoleCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid corporate role payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.createCorporateRole(parsed.data);
    if ("error" in result) {
      return reply.status(403).send({
        message: "Only an approved maker can create roles"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/auth/users/:userId/actions", async (request, reply) => {
    const params = request.params as { userId: string };
    const parsed = approvalActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid user approval payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.applyCorporateUserApprovalAction(
      params.userId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved checker can review users"
        });
      }

      if (result.error === "user_not_found") {
        return reply.status(404).send({
          message: "Corporate user not found"
        });
      }

      return reply.status(409).send({
        message: "This user is not waiting for approval",
        currentState: result.currentState
      });
    }

    return result.data;
  });

  app.post("/v1/auth/corporate-roles/:roleId/actions", async (request, reply) => {
    const params = request.params as { roleId: string };
    const parsed = approvalActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid role approval payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.applyCorporateRoleApprovalAction(
      params.roleId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved checker can review roles"
        });
      }

      if (result.error === "role_not_found") {
        return reply.status(404).send({
          message: "Corporate role not found"
        });
      }

      return reply.status(409).send({
        message: "This role is not waiting for approval",
        currentState: result.currentState
      });
    }

    return result.data;
  });
};
