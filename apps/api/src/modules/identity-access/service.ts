import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { hashPassword, verifyPassword, signJwt } from "@cmsv01/shared/crypto";

import type { AppConfig } from "@cmsv01/shared/config";

import { NotificationsService } from "../notifications/service.js";
import type {
  ApprovalActionRequest,
  AuthenticatedUser,
  CorporatePermission,
  CorporateRoleName,
  CorporateRole,
  CorporateRoleCreateRequest,
  CorporateRoleUpdateRequest,
  RoleDebitAccountAccess,
  RoleDebitAccountAccessUpdateRequest,
  CorporateUser,
  CorporateUserCreateRequest,
  LoginRequest,
  Role
} from "./contracts.js";

const supportedRoles: Role[] = [
  "bank_admin",
  "bank_ops",
  "corporate_admin",
  "maker",
  "checker",
  "support_admin"
];

const corporatePermissionTemplates: Record<string, CorporatePermission[]> = {
  maker: [
    "transaction.make",
    "beneficiary.make",
    "roles.make",
    "user.make",
    "devportal.view",
    "settings.view",
    "settings.edit"
  ],
  checker: [
    "transaction.checker",
    "beneficiary.checker",
    "roles.checker",
    "user.checker",
    "devportal.view",
    "settings.view",
    "settings.edit"
  ]
};

type CorporateUserRow = {
  user_id: string;
  username: string;
  password: string;
  display_name: string;
  role: CorporateUser["role"];
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  status: CorporateUser["status"];
  approval_state: CorporateUser["approvalState"];
  review_comment: string | null;
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by_user_id: string | null;
  reviewed_by_role: string | null;
};

type CorporateRoleRow = {
  role_id: string;
  corporate_tenant_id: string;
  name: string;
  description: string | null;
  status: CorporateRole["status"];
  permissions: string[] | null;
  approval_state: CorporateRole["approvalState"];
  review_comment: string | null;
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by_user_id: string | null;
  reviewed_by_role: string | null;
};

type RoleDebitAccountAccessRow = {
  access_id: string;
  corporate_tenant_id: string;
  role_name: string;
  debit_account_id: string;
  status: "active" | "inactive";
  created_at: Date | null;
  updated_at: Date | null;
};

export class IdentityAccessService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly config: AppConfig,
    private readonly notificationsService = new NotificationsService()
  ) {}

  getSupportedRoles() {
    return supportedRoles;
  }

  async login(payload: LoginRequest) {
    const result = await this.db.query<CorporateUserRow>(
      `select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where username = $1`,
      [payload.username]
    );

    const user = result.rows[0];
    if (
      !user ||
      !verifyPassword(payload.password, user.password) ||
      user.status !== "active" ||
      user.approval_state !== "approved"
    ) {
      return {
        error: "invalid_credentials" as const
      };
    }

    const permissions = await this.getEffectivePermissionsForRole(
      user.corporate_tenant_id,
      user.role
    );

    const session: AuthenticatedUser = {
      userId: user.user_id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      tenantScope: "corporate" as const,
      bankTenantId: user.bank_tenant_id,
      corporateTenantId: user.corporate_tenant_id,
      corporateId: user.corporate_id,
      status: "active" as const,
      permissions
    };

    const token = signJwt(session);
    session.token = token;

    return {
      data: {
        message: "Login successful",
        authMode: "built-in",
        databaseConfigured: Boolean(this.config.databaseUrl),
        token,
        session
      }
    };
  }

  async listCorporateUsers(corporateTenantId?: string, corporateId?: string) {
    const result = corporateTenantId && corporateId
      ? await this.db.query<CorporateUserRow>(
          `select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           where corporate_tenant_id = $1
             and (corporate_id = $2 or corporate_id is null)
           order by username`,
          [corporateTenantId, corporateId]
        )
      : corporateTenantId
      ? await this.db.query<CorporateUserRow>(
          `select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           where corporate_tenant_id = $1
           order by username`,
          [corporateTenantId]
        )
      : await this.db.query<CorporateUserRow>(
          `select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           order by username`
        );

    return result.rows.map(mapCorporateUserRow);
  }

  async getCorporateUserById(userId: string) {
    const result = await this.db.query<CorporateUserRow>(
      `select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    return row ? mapCorporateUserRow(row) : null;
  }

  async getCorporateUserByUsername(username: string) {
    const result = await this.db.query<CorporateUserRow>(
      `select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where username = $1`,
      [username]
    );

    const row = result.rows[0];
    return row ? mapCorporateUserRow(row) : null;
  }

  async getCorporateRoleByName(corporateTenantId: string, roleName: string) {
    const result = await this.db.query<CorporateRoleRow>(
      `select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where corporate_tenant_id = $1 and name = $2
       limit 1`,
      [corporateTenantId, roleName]
    );

    const row = result.rows[0];
    return row ? mapCorporateRoleRow(row) : null;
  }

  async getEffectivePermissionsForRole(corporateTenantId: string, roleName: string) {
    const role = await this.getCorporateRoleByName(corporateTenantId, roleName);
    const storedPermissions = role?.permissions ?? [];
    if (storedPermissions.length > 0) {
      return storedPermissions;
    }

    return corporatePermissionTemplates[roleName] ?? [];
  }

  async listApprovedTransactionCheckerRoleNames(corporateTenantId: string) {
    const roles = await this.listCorporateRoles(corporateTenantId);
    return roles
      .filter(
        (role) =>
          role.status === "active" &&
          role.approvalState === "approved" &&
          role.permissions.includes("transaction.checker")
      )
      .map((role) => role.name);
  }

  async listApprovedTransactionCheckerRoleNamesForSubscription(
    corporateTenantId: string,
    subscriptionId: string
  ) {
    const validRoleNames = new Set(
      await this.listApprovedTransactionCheckerRoleNames(corporateTenantId)
    );
    const result = await this.db.query<{ role_name: string }>(
      `select distinct role_name
       from subscription_user_access
       where subscription_id = $1
         and status = 'active'`,
      [subscriptionId]
    );

    return result.rows
      .map((row) => row.role_name)
      .filter((roleName) => validRoleNames.has(roleName));
  }

  async listRoleDebitAccountAccess(
    corporateTenantId: string,
    roleName?: string
  ) {
    const result = roleName
      ? await this.db.query<RoleDebitAccountAccessRow>(
          `select access_id, corporate_tenant_id, role_name, debit_account_id, status, created_at, updated_at
           from role_debit_account_access
           where corporate_tenant_id = $1
             and role_name = $2
           order by role_name, debit_account_id`,
          [corporateTenantId, roleName]
        )
      : await this.db.query<RoleDebitAccountAccessRow>(
          `select access_id, corporate_tenant_id, role_name, debit_account_id, status, created_at, updated_at
           from role_debit_account_access
           where corporate_tenant_id = $1
           order by role_name, debit_account_id`,
          [corporateTenantId]
        );

    return result.rows.map(mapRoleDebitAccountAccessRow);
  }

  async replaceRoleDebitAccountAccess(payload: RoleDebitAccountAccessUpdateRequest) {
    const actor = await this.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.userHasPermission(payload.actedByUserId, "settings.edit"))) {
      return { error: "forbidden" as const };
    }

    const role = await this.getCorporateRoleByName(payload.corporateTenantId, payload.roleName);
    if (!role) {
      return { error: "role_not_found" as const };
    }

    const client = await this.db.connect();
    try {
      await client.query("begin");
      await client.query(
        `delete from role_debit_account_access
         where corporate_tenant_id = $1
           and role_name = $2`,
        [payload.corporateTenantId, payload.roleName]
      );

      for (const debitAccountId of [...new Set(payload.debitAccountIds)]) {
        await client.query(
          `insert into role_debit_account_access (
             access_id, corporate_tenant_id, role_name, debit_account_id, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, 'active', now(), now())`,
          [
            `rdaa-${payload.corporateTenantId}-${payload.roleName}-${debitAccountId}`,
            payload.corporateTenantId,
            payload.roleName,
            debitAccountId
          ]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return {
      data: await this.listRoleDebitAccountAccess(payload.corporateTenantId, payload.roleName)
    };
  }

  async getAllowedDebitAccountIdsForRole(
    corporateTenantId: string,
    roleName: string
  ) {
    const result = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from role_debit_account_access
       where corporate_tenant_id = $1
         and role_name = $2
         and status = 'active'
       order by debit_account_id`,
      [corporateTenantId, roleName]
    );

    return result.rows.map((row) => row.debit_account_id);
  }

  async listApprovedTransactionCheckerRoleNamesForSubscriptionAndDebitAccount(
    corporateTenantId: string,
    subscriptionId: string,
    debitAccountId?: string | null
  ) {
    const roleNames = await this.listApprovedTransactionCheckerRoleNamesForSubscription(
      corporateTenantId,
      subscriptionId
    );

    if (!debitAccountId) {
      return roleNames;
    }

    const allowedRows = await this.db.query<{ role_name: string }>(
      `select distinct role_name
       from role_debit_account_access
       where corporate_tenant_id = $1
         and debit_account_id = $2
         and status = 'active'`,
      [corporateTenantId, debitAccountId]
    );

    const allowedRoleNames = new Set(allowedRows.rows.map((row) => row.role_name));
    if (allowedRoleNames.size === 0) {
      return roleNames;
    }

    return roleNames.filter((roleName) => allowedRoleNames.has(roleName));
  }

  async userHasActiveSubscriptionAccess(subscriptionId: string, userId: string) {
    const result = await this.db.query<{ role_name: string }>(
      `select role_name
       from subscription_user_access
       where subscription_id = $1
         and user_id = $2
         and status = 'active'
       limit 1`,
      [subscriptionId, userId]
    );

    return Boolean(result.rows[0]);
  }

  async userHasPermission(userId: string, permission: CorporatePermission) {
    const user = await this.getCorporateUserById(userId);
    if (!user || user.approvalState !== "approved" || user.status !== "active") {
      return false;
    }

    const permissions = await this.getEffectivePermissionsForRole(
      user.corporateTenantId,
      user.role
    );

    return permissions.includes(permission);
  }

  async createCorporateUser(payload: CorporateUserCreateRequest) {
    const actor = await this.getCorporateUserById(payload.createdByUserId);
    if (!actor || !(await this.userHasPermission(payload.createdByUserId, "user.make"))) {
      return {
        error: "forbidden" as const
      };
    }

    const targetRole = await this.getCorporateRoleByName(
      payload.corporateTenantId,
      payload.role
    );

    if (!targetRole) {
      return {
        error: "role_not_found" as const
      };
    }

    const result = await this.db.query<CorporateUserRow>(
      `insert into corporate_users (
         user_id, username, password, display_name, role, bank_tenant_id,
         corporate_tenant_id, corporate_id, status, approval_state, review_comment,
         created_by_user_id, created_by_role, created_at, updated_at,
         reviewed_at, reviewed_by_user_id, reviewed_by_role
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'inactive', 'pending_approval', null,
               $9, $10, now(), now(), null, null, null)
       on conflict (username) do update
       set password = excluded.password,
           display_name = excluded.display_name,
           role = excluded.role,
           bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           status = excluded.status,
           approval_state = excluded.approval_state,
           review_comment = excluded.review_comment,
           created_by_user_id = excluded.created_by_user_id,
           created_by_role = excluded.created_by_role,
           updated_at = now(),
           reviewed_at = null,
           reviewed_by_user_id = null,
           reviewed_by_role = null
       returning user_id, username, password, display_name, role, bank_tenant_id,
                 corporate_tenant_id, corporate_id, status, approval_state, review_comment,
                 created_by_user_id, created_by_role, created_at, updated_at,
                 reviewed_at, reviewed_by_user_id, reviewed_by_role`,
      [
        payload.userId,
        payload.username,
        hashPassword(payload.password),
        payload.displayName,
        payload.role,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId ?? null,
        payload.createdByUserId,
        actor.role
      ]
    );

    const created = mapCorporateUserRow(result.rows[0]);
    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId ?? null,
      permission: "user.checker",
      title: "User approval pending",
      message: `${payload.displayName} is waiting for checker approval.`,
      targetSection: "approvals",
      entityType: "user",
      entityId: created.userId
    });

    return {
      data: created
    };
  }

  async listCorporateRoles(corporateTenantId?: string) {
    const result = corporateTenantId
      ? await this.db.query<CorporateRoleRow>(
          `select role_id, corporate_tenant_id, name, description, status, permissions,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_roles
           where corporate_tenant_id = $1
           order by name`,
          [corporateTenantId]
        )
      : await this.db.query<CorporateRoleRow>(
          `select role_id, corporate_tenant_id, name, description, status, permissions,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_roles
           order by name`
        );

    return result.rows.map(mapCorporateRoleRow);
  }

  async createCorporateRole(payload: CorporateRoleCreateRequest) {
    const actor = await this.getCorporateUserById(payload.createdByUserId);
    if (!actor || !(await this.userHasPermission(payload.createdByUserId, "roles.make"))) {
      return {
        error: "forbidden" as const
      };
    }

    const existingRole = await this.db.query<CorporateRoleRow>(
      `select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where corporate_tenant_id = $1 and name = $2
       limit 1`,
      [payload.corporateTenantId, payload.name]
    );

    const roleId =
      payload.roleId ??
      existingRole.rows[0]?.role_id ??
      `${payload.corporateTenantId}-${normalizeRoleNameForId(payload.name)}`;

    const result = await this.db.query<CorporateRoleRow>(
      `insert into corporate_roles (
         role_id, corporate_tenant_id, name, description, status, permissions,
         approval_state, review_comment, created_by_user_id, created_by_role,
         created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       )
       values ($1, $2, $3, $4, 'inactive', $5, 'pending_approval', null,
               $6, $7, now(), now(), null, null, null)
       on conflict (role_id) do update
       set corporate_tenant_id = excluded.corporate_tenant_id,
           name = excluded.name,
           description = excluded.description,
           status = excluded.status,
           permissions = excluded.permissions,
           approval_state = excluded.approval_state,
           review_comment = excluded.review_comment,
           created_by_user_id = excluded.created_by_user_id,
           created_by_role = excluded.created_by_role,
           updated_at = now(),
           reviewed_at = null,
           reviewed_by_user_id = null,
           reviewed_by_role = null
       returning role_id, corporate_tenant_id, name, description, status, permissions,
                 approval_state, review_comment, created_by_user_id, created_by_role,
                 created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role`,
      [
        roleId,
        payload.corporateTenantId,
        payload.name,
        payload.description ?? null,
        payload.permissions,
        payload.createdByUserId,
        actor.role
      ]
    );

    const created = mapCorporateRoleRow(result.rows[0]);
    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: payload.corporateTenantId,
      permission: "roles.checker",
      title: "Role approval pending",
      message: `${payload.name} is waiting for checker approval.`,
      targetSection: "approvals",
      entityType: "role",
      entityId: created.roleId
    });

    return {
      data: created
    };
  }

  async updateCorporateRole(roleId: string, payload: CorporateRoleUpdateRequest) {
    const actor = await this.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.userHasPermission(payload.actedByUserId, "roles.make"))) {
      return {
        error: "forbidden" as const
      };
    }

    const currentResult = await this.db.query<CorporateRoleRow>(
      `select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where role_id = $1
       limit 1`,
      [roleId]
    );

    const current = currentResult.rows[0];
    if (!current) {
      return {
        error: "role_not_found" as const
      };
    }

    if (current.corporate_tenant_id !== payload.corporateTenantId) {
      return {
        error: "forbidden" as const
      };
    }

    const duplicateRole = await this.db.query<{ role_id: string }>(
      `select role_id
       from corporate_roles
       where corporate_tenant_id = $1
         and lower(name) = lower($2)
         and role_id <> $3
       limit 1`,
      [payload.corporateTenantId, payload.name, roleId]
    );

    if (duplicateRole.rows[0]) {
      return {
        error: "role_name_conflict" as const
      };
    }

    const result = await this.db.query<CorporateRoleRow>(
      `update corporate_roles
       set name = $2,
           description = $3,
           permissions = $4,
           status = $5,
           updated_at = now()
       where role_id = $1
       returning role_id, corporate_tenant_id, name, description, status, permissions,
                 approval_state, review_comment, created_by_user_id, created_by_role,
                 created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role`,
      [
        roleId,
        payload.name,
        payload.description ?? null,
        payload.permissions,
        payload.status
      ]
    );

    return {
      data: mapCorporateRoleRow(result.rows[0])
    };
  }

  async applyCorporateUserApprovalAction(userId: string, payload: ApprovalActionRequest) {
    const actor = await this.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.userHasPermission(payload.actedByUserId, "user.checker"))) {
      return {
        error: "forbidden" as const
      };
    }

    const current = await this.getCorporateUserById(userId);
    if (!current) {
      return {
        error: "user_not_found" as const
      };
    }

    if (current.approvalState !== "pending_approval") {
      return {
        error: "invalid_transition" as const,
        currentState: current.approvalState
      };
    }

    const nextApprovalState = payload.action === "approve" ? "approved" : "rejected";
    const nextStatus = payload.action === "approve" ? "active" : "inactive";

    const result = await this.db.query<CorporateUserRow>(
      `update corporate_users
       set approval_state = $2,
           status = $3,
           review_comment = $4,
           reviewed_at = now(),
           reviewed_by_user_id = $5,
           reviewed_by_role = $6,
           updated_at = now()
       where user_id = $1
       returning user_id, username, password, display_name, role, bank_tenant_id,
                 corporate_tenant_id, corporate_id, status, approval_state, review_comment,
                 created_by_user_id, created_by_role, created_at, updated_at,
                 reviewed_at, reviewed_by_user_id, reviewed_by_role`,
      [userId, nextApprovalState, nextStatus, payload.comment ?? null, actor.userId, actor.role]
    );

    const updated = mapCorporateUserRow(result.rows[0]);
    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: current.corporateTenantId,
      corporateId: current.corporateId,
      permission: "user.make",
      title: `User ${payload.action === "approve" ? "approved" : "rejected"}`,
      message: `${current.displayName} was ${payload.action === "approve" ? "approved" : "rejected"} by ${actor.displayName}.`,
      targetSection: "users",
      entityType: "user",
      entityId: current.userId
    });

    return {
      data: updated
    };
  }

  async applyCorporateRoleApprovalAction(roleId: string, payload: ApprovalActionRequest) {
    const actor = await this.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.userHasPermission(payload.actedByUserId, "roles.checker"))) {
      return {
        error: "forbidden" as const
      };
    }

    const currentResult = await this.db.query<CorporateRoleRow>(
      `select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where role_id = $1`,
      [roleId]
    );

    const current = currentResult.rows[0];
    if (!current) {
      return {
        error: "role_not_found" as const
      };
    }

    if (current.approval_state !== "pending_approval") {
      return {
        error: "invalid_transition" as const,
        currentState: current.approval_state
      };
    }

    const nextApprovalState = payload.action === "approve" ? "approved" : "rejected";
    const nextStatus = payload.action === "approve" ? "active" : "inactive";

    const result = await this.db.query<CorporateRoleRow>(
      `update corporate_roles
       set approval_state = $2,
           status = $3,
           review_comment = $4,
           reviewed_at = now(),
           reviewed_by_user_id = $5,
           reviewed_by_role = $6,
           updated_at = now()
       where role_id = $1
       returning role_id, corporate_tenant_id, name, description, status, permissions,
                 approval_state, review_comment, created_by_user_id, created_by_role,
                 created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role`,
      [roleId, nextApprovalState, nextStatus, payload.comment ?? null, actor.userId, actor.role]
    );

    const updated = mapCorporateRoleRow(result.rows[0]);
    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: current.corporate_tenant_id,
      permission: "roles.make",
      title: `Role ${payload.action === "approve" ? "approved" : "rejected"}`,
      message: `${current.name} was ${payload.action === "approve" ? "approved" : "rejected"} by ${actor.displayName}.`,
      targetSection: "roles",
      entityType: "role",
      entityId: current.role_id
    });

    return {
      data: updated
    };
  }
}

function mapRoleDebitAccountAccessRow(row: RoleDebitAccountAccessRow) {
  return {
    accessId: row.access_id,
    corporateTenantId: row.corporate_tenant_id,
    roleName: row.role_name,
    debitAccountId: row.debit_account_id,
    status: row.status,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null
  } satisfies RoleDebitAccountAccess;
}

function mapCorporateUserRow(row: CorporateUserRow) {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    bankTenantId: row.bank_tenant_id,
    corporateTenantId: row.corporate_tenant_id,
    corporateId: row.corporate_id,
    status: row.status,
    approvalState: row.approval_state,
    reviewComment: row.review_comment,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByRole: row.reviewed_by_role
  } satisfies CorporateUser;
}

function mapCorporateRoleRow(row: CorporateRoleRow) {
  return {
    roleId: row.role_id,
    corporateTenantId: row.corporate_tenant_id,
    name: row.name,
    description: row.description,
    status: row.status,
    permissions: (row.permissions ?? (corporatePermissionTemplates[row.name] ?? [])) as CorporatePermission[],
    approvalState: row.approval_state,
    reviewComment: row.review_comment,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByRole: row.reviewed_by_role
  } satisfies CorporateRole;
}

function normalizeRoleNameForId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
