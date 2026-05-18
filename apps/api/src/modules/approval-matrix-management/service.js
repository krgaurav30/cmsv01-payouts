import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { IdentityAccessService } from "../identity-access/service.js";
export class ApprovalMatrixManagementService {
    identityAccessService;
    db = getDatabasePool(loadConfig());
    constructor(identityAccessService = new IdentityAccessService(loadConfig())) {
        this.identityAccessService = identityAccessService;
    }
    async listMatrices(corporateTenantId) {
        const result = corporateTenantId
            ? await this.db.query(`select matrix_id, corporate_tenant_id, entity_type, amount_from, amount_to,
                  approval_levels, roles, status, created_by_user_id, created_by_role,
                  created_at, updated_at
           from approval_matrices
           where corporate_tenant_id = $1
           order by amount_from asc, amount_to asc, created_at desc nulls last`, [corporateTenantId])
            : await this.db.query(`select matrix_id, corporate_tenant_id, entity_type, amount_from, amount_to,
                  approval_levels, roles, status, created_by_user_id, created_by_role,
                  created_at, updated_at
           from approval_matrices
           order by corporate_tenant_id, amount_from asc, amount_to asc, created_at desc nulls last`);
        return result.rows.map(mapApprovalMatrixRow);
    }
    async createMatrix(payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
        if (!actor || !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "roles.make"))) {
            return { error: "forbidden" };
        }
        if (payload.amountTo < payload.amountFrom) {
            return { error: "invalid_amount_range" };
        }
        const validRoleNames = new Set(await this.identityAccessService.listApprovedTransactionCheckerRoleNames(payload.corporateTenantId));
        const invalidRoles = payload.roles.filter((role) => !validRoleNames.has(role));
        if (invalidRoles.length > 0) {
            return {
                error: "invalid_roles",
                roles: invalidRoles
            };
        }
        const matrixId = payload.matrixId ??
            `${payload.corporateTenantId}-txn-${payload.amountFrom}-${payload.amountTo}-${payload.approvalLevels}-${Math.floor(Math.random() * 100000)
                .toString()
                .padStart(5, "0")}`;
        const result = await this.db.query(`insert into approval_matrices (
         matrix_id, corporate_tenant_id, entity_type, amount_from, amount_to,
         approval_levels, roles, status, created_by_user_id, created_by_role,
         created_at, updated_at
       )
       values ($1, $2, 'transaction', $3, $4, $5, $6, $7, $8, $9, now(), now())
       returning matrix_id, corporate_tenant_id, entity_type, amount_from, amount_to,
                 approval_levels, roles, status, created_by_user_id, created_by_role,
                 created_at, updated_at`, [
            matrixId,
            payload.corporateTenantId,
            payload.amountFrom,
            payload.amountTo,
            payload.approvalLevels,
            payload.roles,
            payload.status,
            payload.createdByUserId,
            actor.role
        ]);
        return {
            data: mapApprovalMatrixRow(result.rows[0])
        };
    }
    async buildTransactionApprovalPlan(corporateTenantId, amount) {
        const result = await this.db.query(`select matrix_id, corporate_tenant_id, entity_type, amount_from, amount_to,
              approval_levels, roles, status, created_by_user_id, created_by_role,
              created_at, updated_at
       from approval_matrices
       where corporate_tenant_id = $1
         and entity_type = 'transaction'
         and status = 'active'
         and $2 >= amount_from
         and $2 <= amount_to
       order by amount_from asc, amount_to asc, created_at asc`, [corporateTenantId, amount]);
        const matrices = result.rows.map(mapApprovalMatrixRow);
        if (matrices.length === 0) {
            const fallbackRoles = await this.identityAccessService.listApprovedTransactionCheckerRoleNames(corporateTenantId);
            return {
                approvalLevelsRequired: 1,
                currentApprovalLevel: 1,
                approvalRoles: fallbackRoles,
                matchedApprovalMatrixIds: [],
                rolesByLevel: [
                    {
                        level: 1,
                        roles: fallbackRoles
                    }
                ]
            };
        }
        const approvalLevelsRequired = Math.max(...matrices.map((matrix) => matrix.approvalLevels));
        const rolesByLevel = Array.from({ length: approvalLevelsRequired }, (_entry, index) => {
            const level = index + 1;
            const roles = [...new Set(matrices
                    .filter((matrix) => matrix.approvalLevels >= level)
                    .flatMap((matrix) => matrix.roles))];
            return {
                level,
                roles
            };
        });
        return {
            approvalLevelsRequired,
            currentApprovalLevel: 1,
            approvalRoles: rolesByLevel[0]?.roles ?? [],
            matchedApprovalMatrixIds: matrices.map((matrix) => matrix.matrixId),
            rolesByLevel
        };
    }
}
function mapApprovalMatrixRow(row) {
    return {
        matrixId: row.matrix_id,
        corporateTenantId: row.corporate_tenant_id,
        entityType: "transaction",
        amountFrom: Number(row.amount_from),
        amountTo: Number(row.amount_to),
        approvalLevels: Math.min(Math.max(row.approval_levels, 1), 3),
        roles: row.roles ?? [],
        status: row.status,
        createdByUserId: row.created_by_user_id,
        createdByRole: row.created_by_role,
        createdAt: row.created_at?.toISOString() ?? null,
        updatedAt: row.updated_at?.toISOString() ?? null
    };
}
