import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import { IdentityAccessService } from "../identity-access/service.js";

import type {
  ApprovalMatrix,
  ApprovalMatrixCreateRequest,
  ApprovalMatrixUpdateRequest,
  ApprovalPlanSnapshot
} from "./contracts.js";

type ApprovalMatrixRow = {
  matrix_id: string;
  name: string;
  corporate_tenant_id: string;
  subscription_ids: string[] | null;
  package_code: string | null;
  package_display_name: string | null;
  debit_account_ids: string[] | null;
  entity_type: "transaction";
  amount_from: string;
  amount_to: string;
  approval_levels: number;
  roles: string[] | null;
  status: "active" | "inactive";
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export class ApprovalMatrixManagementService {
  private readonly db = getDatabasePool(loadConfig());
  private hasNameColumnPromise: Promise<boolean> | null = null;

  constructor(
    private readonly identityAccessService = new IdentityAccessService(loadConfig())
  ) {}

  private async hasNameColumn() {
    if (!this.hasNameColumnPromise) {
      this.hasNameColumnPromise = this.db
        .query<{ exists: boolean }>(
          `select exists (
             select 1
             from information_schema.columns
             where table_name = 'approval_matrices'
               and column_name = 'name'
           ) as exists`
        )
        .then((result) => result.rows[0]?.exists ?? false)
        .catch(() => false);
    }

    return this.hasNameColumnPromise;
  }

  async listMatrices(corporateTenantId?: string, subscriptionId?: string) {
    const hasNameColumn = await this.hasNameColumn();
    const selectName = hasNameColumn ? "am.name" : "am.matrix_id as name";
    const result = corporateTenantId && subscriptionId
      ? await this.db.query<ApprovalMatrixRow>(
          `select am.matrix_id, ${selectName}, am.corporate_tenant_id, am.subscription_ids,
                  cs.package_code, cs.display_name as package_display_name,
                  am.debit_account_ids, am.entity_type, am.amount_from, am.amount_to,
                  am.approval_levels, am.roles, am.status, am.created_by_user_id, am.created_by_role,
                  am.created_at, am.updated_at
           from approval_matrices am
           left join corporate_subscriptions cs on cs.subscription_id = am.subscription_ids[1]
           where am.corporate_tenant_id = $1
             and $2 = any(am.subscription_ids)
           order by am.updated_at desc, am.created_at desc nulls last`,
          [corporateTenantId, subscriptionId]
        )
      : corporateTenantId
      ? await this.db.query<ApprovalMatrixRow>(
          `select am.matrix_id, ${selectName}, am.corporate_tenant_id, am.subscription_ids,
                  cs.package_code, cs.display_name as package_display_name,
                  am.debit_account_ids, am.entity_type, am.amount_from, am.amount_to,
                  am.approval_levels, am.roles, am.status, am.created_by_user_id, am.created_by_role,
                  am.created_at, am.updated_at
           from approval_matrices am
           left join corporate_subscriptions cs on cs.subscription_id = am.subscription_ids[1]
           where am.corporate_tenant_id = $1
           order by am.updated_at desc, am.created_at desc nulls last`,
          [corporateTenantId]
        )
      : await this.db.query<ApprovalMatrixRow>(
          `select am.matrix_id, ${selectName}, am.corporate_tenant_id, am.subscription_ids,
                  cs.package_code, cs.display_name as package_display_name,
                  am.debit_account_ids, am.entity_type, am.amount_from, am.amount_to,
                  am.approval_levels, am.roles, am.status, am.created_by_user_id, am.created_by_role,
                  am.created_at, am.updated_at
           from approval_matrices am
           left join corporate_subscriptions cs on cs.subscription_id = am.subscription_ids[1]
           order by am.corporate_tenant_id, am.updated_at desc, am.created_at desc nulls last`
        );

    return result.rows.map(mapApprovalMatrixRow);
  }

  async createMatrix(payload: ApprovalMatrixCreateRequest) {
    const hasNameColumn = await this.hasNameColumn();
    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    if (!actor || !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "roles.make"))) {
      return { error: "forbidden" as const };
    }

    if (payload.amountTo < payload.amountFrom) {
      return { error: "invalid_amount_range" as const };
    }

    const validRoleNames = new Set(
      await this.identityAccessService.listApprovedTransactionCheckerRoleNames(
        payload.corporateTenantId
      )
    );

    const invalidRoles = payload.roles.filter((role) => {
      const bareRoleName = role.includes(":") ? role.substring(role.indexOf(":") + 1) : role;
      return !validRoleNames.has(bareRoleName);
    });
    if (invalidRoles.length > 0) {
      return {
        error: "invalid_roles" as const,
        roles: invalidRoles
      };
    }

    const validDebitAccounts = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from subscription_debit_accounts
       where subscription_id = $1
         and status = 'active'
         and debit_account_id = any($2::text[])`,
      [payload.subscriptionId, payload.debitAccountIds]
    );

    if (validDebitAccounts.rows.length !== payload.debitAccountIds.length) {
      return {
        error: "invalid_debit_accounts" as const
      };
    }

    const rolesMissingDebitAccountAccess: string[] = [];
    for (const rawRoleName of payload.roles) {
      const roleName = rawRoleName.includes(":")
        ? rawRoleName.substring(rawRoleName.indexOf(":") + 1)
        : rawRoleName;
      const allowedDebitAccountIds =
        await this.identityAccessService.getAllowedDebitAccountIdsForRole(
          payload.corporateTenantId,
          roleName
        );

      if (
        allowedDebitAccountIds.length === 0 ||
        payload.debitAccountIds.some(
          (debitAccountId) => !allowedDebitAccountIds.includes(debitAccountId)
        )
      ) {
        rolesMissingDebitAccountAccess.push(rawRoleName);
      }
    }

    if (rolesMissingDebitAccountAccess.length > 0) {
      return {
        error: "roles_missing_debit_account_access" as const,
        roles: rolesMissingDebitAccountAccess
      };
    }

    const matrixId =
      payload.matrixId ??
      `${payload.corporateTenantId}-txn-${payload.amountFrom}-${payload.amountTo}-${payload.approvalLevels}-${Math.floor(
        Math.random() * 100000
      )
        .toString()
        .padStart(5, "0")}`;

    const result = hasNameColumn
      ? await this.db.query<ApprovalMatrixRow>(
          `insert into approval_matrices (
             matrix_id, name, corporate_tenant_id, subscription_ids, debit_account_ids, entity_type,
             amount_from, amount_to, approval_levels, roles, status, created_by_user_id, created_by_role,
             created_at, updated_at
           )
           values ($1, $2, $3, array[$4]::text[], $5::text[], 'transaction', $6, $7, $8, $9, $10, $11, $12, now(), now())
           returning matrix_id, name, corporate_tenant_id, subscription_ids, null::text as package_code,
                     null::text as package_display_name, debit_account_ids, entity_type, amount_from, amount_to,
                     approval_levels, roles, status, created_by_user_id, created_by_role,
                     created_at, updated_at`,
          [
            matrixId,
            payload.name,
            payload.corporateTenantId,
            payload.subscriptionId,
            payload.debitAccountIds,
            payload.amountFrom,
            payload.amountTo,
            payload.approvalLevels,
            payload.roles,
            payload.status,
            payload.createdByUserId,
            actor.role
          ]
        )
      : await this.db.query<ApprovalMatrixRow>(
          `insert into approval_matrices (
             matrix_id, corporate_tenant_id, subscription_ids, debit_account_ids, entity_type,
             amount_from, amount_to, approval_levels, roles, status, created_by_user_id, created_by_role,
             created_at, updated_at
           )
           values ($1, $2, $3, array[$4]::text[], $5::text[], 'transaction', $6, $7, $8, $9, $10, $11, now(), now())
           returning matrix_id, matrix_id as name, corporate_tenant_id, subscription_ids, null::text as package_code,
                     null::text as package_display_name, debit_account_ids, entity_type, amount_from, amount_to,
                     approval_levels, roles, status, created_by_user_id, created_by_role,
                     created_at, updated_at`,
          [
            matrixId,
            payload.corporateTenantId,
            payload.subscriptionId,
            payload.debitAccountIds,
            payload.amountFrom,
            payload.amountTo,
            payload.approvalLevels,
            payload.roles,
            payload.status,
            payload.createdByUserId,
            actor.role
          ]
        );

    return {
      data: mapApprovalMatrixRow(result.rows[0])
    };
  }

  async buildTransactionApprovalPlan(
    corporateTenantId: string,
    amount: number,
    subscriptionId?: string | null,
    debitAccountId?: string | null
  ) {
    const params: Array<string | number> = [corporateTenantId, amount];
    let subscriptionClause = "";
    let debitAccountClause = "";

    if (subscriptionId) {
      params.push(subscriptionId);
      subscriptionClause = `and $${params.length} = any(subscription_ids)`;
    }

    if (debitAccountId) {
      params.push(debitAccountId);
      debitAccountClause = `and $${params.length} = any(debit_account_ids)`;
    }

    const result = await this.db.query<ApprovalMatrixRow>(
      `select matrix_id, name, corporate_tenant_id, subscription_ids, null::text as package_code,
              null::text as package_display_name, debit_account_ids, entity_type, amount_from, amount_to,
              approval_levels, roles, status, created_by_user_id, created_by_role,
              created_at, updated_at
       from approval_matrices
       where corporate_tenant_id = $1
         and entity_type = 'transaction'
         and status = 'active'
         and $2 >= amount_from
         and $2 <= amount_to
         ${subscriptionClause}
         ${debitAccountClause}
       order by amount_from asc, amount_to asc, created_at asc`,
      params
    );

    const matrices = result.rows.map(mapApprovalMatrixRow);
    if (matrices.length === 0) {
      const fallbackRoles = subscriptionId
        ? await this.identityAccessService.listApprovedTransactionCheckerRoleNamesForSubscriptionAndDebitAccount(
            corporateTenantId,
            subscriptionId,
            debitAccountId
          )
        : await this.identityAccessService.listApprovedTransactionCheckerRoleNames(
            corporateTenantId
          );

      return {
        approvalLevelsRequired: 1,
        currentApprovalLevel: 1,
        approvalRoles: fallbackRoles,
        matchedApprovalMatrixIds: [],
        debitAccountId: debitAccountId ?? null,
        rolesByLevel: [
          {
            level: 1,
            roles: fallbackRoles
          }
        ]
      } satisfies ApprovalPlanSnapshot;
    }

    const approvalLevelsRequired = Math.max(...matrices.map((matrix) => matrix.approvalLevels));
    const rolesByLevel = Array.from({ length: approvalLevelsRequired }, (_entry, index) => {
      const level = index + 1;
      const roles = [...new Set(
        matrices
          .filter((matrix) => matrix.approvalLevels >= level)
          .flatMap((matrix) => {
            const levelRoles: string[] = [];
            for (const r of matrix.roles) {
              if (r.startsWith(`${level}:`)) {
                levelRoles.push(r.substring(r.indexOf(":") + 1));
              } else if (!r.includes(":")) {
                levelRoles.push(r);
              }
            }
            return levelRoles;
          })
      )];

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
      debitAccountId: debitAccountId ?? null,
      rolesByLevel
    } satisfies ApprovalPlanSnapshot;
  }

  async updateMatrix(matrixId: string, payload: ApprovalMatrixUpdateRequest) {
    const hasNameColumn = await this.hasNameColumn();
    const existing = await this.db.query<{ matrix_id: string }>(
      `select matrix_id from approval_matrices where matrix_id = $1 limit 1`,
      [matrixId]
    );

    if (!existing.rows[0]) {
      return { error: "matrix_not_found" as const };
    }

    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    if (!actor || !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "roles.make"))) {
      return { error: "forbidden" as const };
    }

    if (payload.amountTo < payload.amountFrom) {
      return { error: "invalid_amount_range" as const };
    }

    const validRoleNames = new Set(
      await this.identityAccessService.listApprovedTransactionCheckerRoleNames(
        payload.corporateTenantId
      )
    );

    const invalidRoles = payload.roles.filter((role) => {
      const bareRoleName = role.includes(":") ? role.substring(role.indexOf(":") + 1) : role;
      return !validRoleNames.has(bareRoleName);
    });
    if (invalidRoles.length > 0) {
      return {
        error: "invalid_roles" as const,
        roles: invalidRoles
      };
    }

    const validDebitAccounts = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from subscription_debit_accounts
       where subscription_id = $1
         and status = 'active'
         and debit_account_id = any($2::text[])`,
      [payload.subscriptionId, payload.debitAccountIds]
    );

    if (validDebitAccounts.rows.length !== payload.debitAccountIds.length) {
      return {
        error: "invalid_debit_accounts" as const
      };
    }

    const rolesMissingDebitAccountAccess: string[] = [];
    for (const rawRoleName of payload.roles) {
      const roleName = rawRoleName.includes(":")
        ? rawRoleName.substring(rawRoleName.indexOf(":") + 1)
        : rawRoleName;
      const allowedDebitAccountIds =
        await this.identityAccessService.getAllowedDebitAccountIdsForRole(
          payload.corporateTenantId,
          roleName
        );

      if (
        allowedDebitAccountIds.length === 0 ||
        payload.debitAccountIds.some(
          (debitAccountId) => !allowedDebitAccountIds.includes(debitAccountId)
        )
      ) {
        rolesMissingDebitAccountAccess.push(rawRoleName);
      }
    }

    if (rolesMissingDebitAccountAccess.length > 0) {
      return {
        error: "roles_missing_debit_account_access" as const,
        roles: rolesMissingDebitAccountAccess
      };
    }

    const result = hasNameColumn
      ? await this.db.query<ApprovalMatrixRow>(
          `update approval_matrices
           set corporate_tenant_id = $2,
               name = $3,
               subscription_ids = array[$4]::text[],
               debit_account_ids = $5::text[],
               amount_from = $6,
               amount_to = $7,
               approval_levels = $8,
               roles = $9,
               status = $10,
               created_by_user_id = $11,
               created_by_role = $12,
               updated_at = now()
           where matrix_id = $1
           returning matrix_id, name, corporate_tenant_id, subscription_ids, null::text as package_code,
                     null::text as package_display_name, debit_account_ids, entity_type, amount_from, amount_to,
                     approval_levels, roles, status, created_by_user_id, created_by_role,
                     created_at, updated_at`,
          [
            matrixId,
            payload.corporateTenantId,
            payload.name,
            payload.subscriptionId,
            payload.debitAccountIds,
            payload.amountFrom,
            payload.amountTo,
            payload.approvalLevels,
            payload.roles,
            payload.status,
            payload.createdByUserId,
            actor.role
          ]
        )
      : await this.db.query<ApprovalMatrixRow>(
          `update approval_matrices
           set corporate_tenant_id = $2,
               subscription_ids = array[$3]::text[],
               debit_account_ids = $4::text[],
               amount_from = $5,
               amount_to = $6,
               approval_levels = $7,
               roles = $8,
               status = $9,
               created_by_user_id = $10,
               created_by_role = $11,
               updated_at = now()
           where matrix_id = $1
           returning matrix_id, matrix_id as name, corporate_tenant_id, subscription_ids, null::text as package_code,
                     null::text as package_display_name, debit_account_ids, entity_type, amount_from, amount_to,
                     approval_levels, roles, status, created_by_user_id, created_by_role,
                     created_at, updated_at`,
          [
            matrixId,
            payload.corporateTenantId,
            payload.subscriptionId,
            payload.debitAccountIds,
            payload.amountFrom,
            payload.amountTo,
            payload.approvalLevels,
            payload.roles,
            payload.status,
            payload.createdByUserId,
            actor.role
          ]
        );

    return {
      data: mapApprovalMatrixRow(result.rows[0])
    };
  }
}

function mapApprovalMatrixRow(row: ApprovalMatrixRow) {
  return {
    matrixId: row.matrix_id,
    name: row.name,
    corporateTenantId: row.corporate_tenant_id,
    subscriptionId: row.subscription_ids && row.subscription_ids.length > 0 ? row.subscription_ids[0] : null,
    packageCode: row.package_code,
    packageDisplayName: row.package_display_name,
    debitAccountIds: row.debit_account_ids ?? [],
    entityType: "transaction",
    amountFrom: Number(row.amount_from),
    amountTo: Number(row.amount_to),
    approvalLevels: Math.min(Math.max(row.approval_levels, 1), 3) as 1 | 2 | 3,
    roles: row.roles ?? [],
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null
  } satisfies ApprovalMatrix;
}
