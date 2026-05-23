import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "@cmsv01/shared/config";

import {
  approvalActionSchema,
  corporateRoleCreateSchema,
  corporateRoleUpdateSchema,
  corporateUserCreateSchema,
  loginRequestSchema,
  roleDebitAccountAccessUpdateSchema
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

  app.get("/v1/auth/role-debit-account-access", async (request) => {
    const query = request.query as { corporateTenantId?: string; roleName?: string };

    if (!query.corporateTenantId) {
      return {
        items: []
      };
    }

    return {
      items: await identityAccessService.listRoleDebitAccountAccess(
        query.corporateTenantId,
        query.roleName
      )
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

  app.put("/v1/auth/corporate-roles/:roleId", async (request, reply) => {
    const params = request.params as { roleId: string };
    const parsed = corporateRoleUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid corporate role update payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.updateCorporateRole(params.roleId, parsed.data);
    if ("error" in result) {
      if (result.error === "role_not_found") {
        return reply.status(404).send({
          message: "Corporate role not found"
        });
      }

      if (result.error === "role_name_conflict") {
        return reply.status(409).send({
          message: "A role with this name already exists"
        });
      }

      return reply.status(403).send({
        message: "You do not have access to edit roles"
      });
    }

    return result.data;
  });

  app.put("/v1/auth/role-debit-account-access", async (request, reply) => {
    const parsed = roleDebitAccountAccessUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid role debit-account payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await identityAccessService.replaceRoleDebitAccountAccess(parsed.data);
    if ("error" in result) {
      return reply.status(result.error === "role_not_found" ? 404 : 403).send({
        message:
          result.error === "role_not_found"
            ? "Role not found"
            : "You do not have access to manage role debit-account mappings"
      });
    }

    return result.data;
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

  app.put("/v1/auth/users/:userId/status", async (request, reply) => {
    const params = request.params as { userId: string };
    const body = request.body as { status: "active" | "inactive"; actedByUserId: string };

    if (!body || !body.status || !body.actedByUserId) {
      return reply.status(400).send({
        message: "Invalid payload, status and actedByUserId are required"
      });
    }

    if (body.status !== "active" && body.status !== "inactive") {
      return reply.status(400).send({
        message: "Invalid status value"
      });
    }

    const result = await identityAccessService.updateCorporateUserStatus(
      params.userId,
      body.status,
      body.actedByUserId
    );

    if ("error" in result) {
      if (result.error === "user_not_found") {
        return reply.status(404).send({
          message: "User not found"
        });
      }

      return reply.status(403).send({
        message: "You do not have access to manage users"
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
