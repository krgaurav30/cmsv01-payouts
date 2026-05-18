import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { NotificationsService } from "../notifications/service.js";
const supportedRoles = [
    "bank_admin",
    "bank_ops",
    "corporate_admin",
    "maker",
    "checker",
    "support_admin"
];
const corporatePermissionTemplates = {
    maker: [
        "transaction.make",
        "beneficiary.make",
        "roles.make",
        "user.make",
        "devportal.view",
        "settings.view"
    ],
    checker: [
        "transaction.checker",
        "beneficiary.checker",
        "roles.checker",
        "user.checker",
        "devportal.view",
        "settings.view"
    ]
};
export class IdentityAccessService {
    config;
    notificationsService;
    db = getDatabasePool(loadConfig());
    constructor(config, notificationsService = new NotificationsService()) {
        this.config = config;
        this.notificationsService = notificationsService;
    }
    getSupportedRoles() {
        return supportedRoles;
    }
    async login(payload) {
        const result = await this.db.query(`select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where username = $1`, [payload.username]);
        const user = result.rows[0];
        if (!user ||
            user.password !== payload.password ||
            user.status !== "active" ||
            user.approval_state !== "approved") {
            return {
                error: "invalid_credentials"
            };
        }
        const permissions = await this.getEffectivePermissionsForRole(user.corporate_tenant_id, user.role);
        return {
            data: {
                message: "Login successful",
                authMode: "built-in",
                databaseConfigured: Boolean(this.config.databaseUrl),
                session: {
                    userId: user.user_id,
                    username: user.username,
                    displayName: user.display_name,
                    role: user.role,
                    tenantScope: "corporate",
                    bankTenantId: user.bank_tenant_id,
                    corporateTenantId: user.corporate_tenant_id,
                    corporateId: user.corporate_id,
                    status: "active",
                    permissions
                }
            }
        };
    }
    async listCorporateUsers(corporateTenantId, corporateId) {
        const result = corporateTenantId && corporateId
            ? await this.db.query(`select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           where corporate_tenant_id = $1
             and (corporate_id = $2 or corporate_id is null)
           order by username`, [corporateTenantId, corporateId])
            : corporateTenantId
                ? await this.db.query(`select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           where corporate_tenant_id = $1
           order by username`, [corporateTenantId])
                : await this.db.query(`select user_id, username, password, display_name, role,
                  bank_tenant_id, corporate_tenant_id, corporate_id, status,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_users
           order by username`);
        return result.rows.map(mapCorporateUserRow);
    }
    async getCorporateUserById(userId) {
        const result = await this.db.query(`select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where user_id = $1`, [userId]);
        const row = result.rows[0];
        return row ? mapCorporateUserRow(row) : null;
    }
    async getCorporateUserByUsername(username) {
        const result = await this.db.query(`select user_id, username, password, display_name, role,
              bank_tenant_id, corporate_tenant_id, corporate_id, status,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_users
       where username = $1`, [username]);
        const row = result.rows[0];
        return row ? mapCorporateUserRow(row) : null;
    }
    async getCorporateRoleByName(corporateTenantId, roleName) {
        const result = await this.db.query(`select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where corporate_tenant_id = $1 and name = $2
       limit 1`, [corporateTenantId, roleName]);
        const row = result.rows[0];
        return row ? mapCorporateRoleRow(row) : null;
    }
    async getEffectivePermissionsForRole(corporateTenantId, roleName) {
        const role = await this.getCorporateRoleByName(corporateTenantId, roleName);
        const storedPermissions = role?.permissions ?? [];
        if (storedPermissions.length > 0) {
            return storedPermissions;
        }
        return corporatePermissionTemplates[roleName] ?? [];
    }
    async listApprovedTransactionCheckerRoleNames(corporateTenantId) {
        const roles = await this.listCorporateRoles(corporateTenantId);
        return roles
            .filter((role) => role.status === "active" &&
            role.approvalState === "approved" &&
            role.permissions.includes("transaction.checker"))
            .map((role) => role.name);
    }
    async userHasPermission(userId, permission) {
        const user = await this.getCorporateUserById(userId);
        if (!user || user.approvalState !== "approved" || user.status !== "active") {
            return false;
        }
        const permissions = await this.getEffectivePermissionsForRole(user.corporateTenantId, user.role);
        return permissions.includes(permission);
    }
    async createCorporateUser(payload) {
        const actor = await this.getCorporateUserById(payload.createdByUserId);
        if (!actor || !(await this.userHasPermission(payload.createdByUserId, "user.make"))) {
            return {
                error: "forbidden"
            };
        }
        const targetRole = await this.getCorporateRoleByName(payload.corporateTenantId, payload.role);
        if (!targetRole) {
            return {
                error: "role_not_found"
            };
        }
        const result = await this.db.query(`insert into corporate_users (
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
                 reviewed_at, reviewed_by_user_id, reviewed_by_role`, [
            payload.userId,
            payload.username,
            payload.password,
            payload.displayName,
            payload.role,
            payload.bankTenantId,
            payload.corporateTenantId,
            payload.corporateId ?? null,
            payload.createdByUserId,
            actor.role
        ]);
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
    async listCorporateRoles(corporateTenantId) {
        const result = corporateTenantId
            ? await this.db.query(`select role_id, corporate_tenant_id, name, description, status, permissions,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_roles
           where corporate_tenant_id = $1
           order by name`, [corporateTenantId])
            : await this.db.query(`select role_id, corporate_tenant_id, name, description, status, permissions,
                  approval_state, review_comment, created_by_user_id, created_by_role,
                  created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
           from corporate_roles
           order by name`);
        return result.rows.map(mapCorporateRoleRow);
    }
    async createCorporateRole(payload) {
        const actor = await this.getCorporateUserById(payload.createdByUserId);
        if (!actor || !(await this.userHasPermission(payload.createdByUserId, "roles.make"))) {
            return {
                error: "forbidden"
            };
        }
        const existingRole = await this.db.query(`select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where corporate_tenant_id = $1 and name = $2
       limit 1`, [payload.corporateTenantId, payload.name]);
        const roleId = payload.roleId ??
            existingRole.rows[0]?.role_id ??
            `${payload.corporateTenantId}-${normalizeRoleNameForId(payload.name)}`;
        const result = await this.db.query(`insert into corporate_roles (
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
                 created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role`, [
            roleId,
            payload.corporateTenantId,
            payload.name,
            payload.description ?? null,
            payload.permissions,
            payload.createdByUserId,
            actor.role
        ]);
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
    async applyCorporateUserApprovalAction(userId, payload) {
        const actor = await this.getCorporateUserById(payload.actedByUserId);
        if (!actor || !(await this.userHasPermission(payload.actedByUserId, "user.checker"))) {
            return {
                error: "forbidden"
            };
        }
        const current = await this.getCorporateUserById(userId);
        if (!current) {
            return {
                error: "user_not_found"
            };
        }
        if (current.approvalState !== "pending_approval") {
            return {
                error: "invalid_transition",
                currentState: current.approvalState
            };
        }
        const nextApprovalState = payload.action === "approve" ? "approved" : "rejected";
        const nextStatus = payload.action === "approve" ? "active" : "inactive";
        const result = await this.db.query(`update corporate_users
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
                 reviewed_at, reviewed_by_user_id, reviewed_by_role`, [userId, nextApprovalState, nextStatus, payload.comment ?? null, actor.userId, actor.role]);
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
    async applyCorporateRoleApprovalAction(roleId, payload) {
        const actor = await this.getCorporateUserById(payload.actedByUserId);
        if (!actor || !(await this.userHasPermission(payload.actedByUserId, "roles.checker"))) {
            return {
                error: "forbidden"
            };
        }
        const currentResult = await this.db.query(`select role_id, corporate_tenant_id, name, description, status, permissions,
              approval_state, review_comment, created_by_user_id, created_by_role,
              created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role
       from corporate_roles
       where role_id = $1`, [roleId]);
        const current = currentResult.rows[0];
        if (!current) {
            return {
                error: "role_not_found"
            };
        }
        if (current.approval_state !== "pending_approval") {
            return {
                error: "invalid_transition",
                currentState: current.approval_state
            };
        }
        const nextApprovalState = payload.action === "approve" ? "approved" : "rejected";
        const nextStatus = payload.action === "approve" ? "active" : "inactive";
        const result = await this.db.query(`update corporate_roles
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
                 created_at, updated_at, reviewed_at, reviewed_by_user_id, reviewed_by_role`, [roleId, nextApprovalState, nextStatus, payload.comment ?? null, actor.userId, actor.role]);
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
function mapCorporateUserRow(row) {
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
    };
}
function mapCorporateRoleRow(row) {
    return {
        roleId: row.role_id,
        corporateTenantId: row.corporate_tenant_id,
        name: row.name,
        description: row.description,
        status: row.status,
        permissions: (row.permissions ?? (corporatePermissionTemplates[row.name] ?? [])),
        approvalState: row.approval_state,
        reviewComment: row.review_comment,
        createdByUserId: row.created_by_user_id,
        createdByRole: row.created_by_role,
        createdAt: row.created_at?.toISOString() ?? null,
        updatedAt: row.updated_at?.toISOString() ?? null,
        reviewedAt: row.reviewed_at?.toISOString() ?? null,
        reviewedByUserId: row.reviewed_by_user_id,
        reviewedByRole: row.reviewed_by_role
    };
}
function normalizeRoleNameForId(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
