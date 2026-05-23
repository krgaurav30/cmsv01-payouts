import { randomUUID } from "node:crypto";

import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import type {
  CorporateSubscription,
  SubscriptionCreateRequest,
  SubscriptionDebitAccountAccess,
  SubscriptionRoleAccessUpdateRequest,
  SubscriptionStatusUpdateRequest,
  SubscriptionUserAccess
} from "./contracts.js";
import { IdentityAccessService } from "../identity-access/service.js";

type CorporateSubscriptionRow = {
  subscription_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string;
  package_id: string;
  package_code: string;
  display_name: string;
  status: "draft" | "active" | "suspended" | "terminated";
  started_at: Date | null;
  suspended_at: Date | null;
  terminated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type SubscriptionDebitAccountRow = {
  subscription_id: string;
  debit_account_id: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  allowed_payment_method_codes: string[] | null;
  is_default: boolean;
  status: "active" | "inactive";
};

type SubscriptionUserAccessRow = {
  access_id: string;
  subscription_id: string;
  user_id: string;
  username: string;
  display_name: string;
  role_name: string;
  status: "active" | "inactive";
};

type PackageForSubscriptionRow = {
  package_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string | null;
  corporate_id: string | null;
  package_code: string;
  name: string;
  owner_type: "bank" | "corporate";
  status: "active" | "inactive";
  default_debit_mode: string;
  default_file_rejection_mode: string;
};

type PackagePaymentMethodRow = {
  payment_method_code: string;
};

type DebitAccountSeedRow = {
  debit_account_id: string;
  is_default: boolean;
};

type PackageDebitAccountSeedRow = {
  debit_account_id: string;
  is_default: boolean;
};

type SubscriptionUserSeedRow = {
  user_id: string;
  role: string;
};

type CorporateNameRow = {
  name: string;
};

export class SubscriptionManagementService {
  private readonly db = getDatabasePool(loadConfig());
  private readonly identityAccessService = new IdentityAccessService(loadConfig());

  async listSubscriptions(filters?: {
    corporateId?: string;
    corporateTenantId?: string;
    packageCode?: string;
    status?: "draft" | "active" | "suspended" | "terminated";
    userId?: string;
  }) {
    const clauses: string[] = [];
    const values: string[] = [];
    let joinUserAccess = false;

    if (filters?.corporateId) {
      values.push(filters.corporateId);
      clauses.push(`cs.corporate_id = $${values.length}`);
    }

    if (filters?.corporateTenantId) {
      values.push(filters.corporateTenantId);
      clauses.push(`cs.corporate_tenant_id = $${values.length}`);
    }

    if (filters?.packageCode) {
      values.push(filters.packageCode);
      clauses.push(`cs.package_code = $${values.length}`);
    }

    if (filters?.status) {
      values.push(filters.status);
      clauses.push(`cs.status = $${values.length}`);
    }

    if (filters?.userId) {
      joinUserAccess = true;
      values.push(filters.userId);
      clauses.push(`cu.user_id = $${values.length}`);
      clauses.push(`rsa.status = 'active'`);
      clauses.push(`cu.status = 'active'`);
      clauses.push(`coalesce(cu.approval_state, 'approved') = 'approved'`);
    }

    const joins = joinUserAccess
      ? `join role_subscription_access rsa on rsa.subscription_id = cs.subscription_id
         join corporate_users cu on cu.corporate_tenant_id = rsa.corporate_tenant_id and cu.role = rsa.role_name`
      : "";
    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";

    const result = await this.db.query<CorporateSubscriptionRow>(
      `select distinct cs.subscription_id, cs.bank_tenant_id, cs.corporate_tenant_id,
              cs.corporate_id, cs.package_id, cs.package_code, cs.display_name, cs.status,
              cs.started_at, cs.suspended_at, cs.terminated_at, cs.created_by, cs.updated_by,
              cs.created_at, cs.updated_at
       from corporate_subscriptions cs
       ${joins}
       ${whereClause}
       order by cs.package_code, cs.created_at desc`,
      values
    );

    return this.attachChildren(result.rows);
  }

  async getSubscription(subscriptionId: string) {
    const result = await this.db.query<CorporateSubscriptionRow>(
      `select subscription_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_id,
              package_code, display_name, status, started_at, suspended_at, terminated_at,
              created_by, updated_by, created_at, updated_at
       from corporate_subscriptions
       where subscription_id = $1
       limit 1`,
      [subscriptionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [entry] = await this.attachChildren([row]);
    return entry ?? null;
  }

  async findActiveSubscription(corporateId: string, packageCode: string) {
    const result = await this.db.query<CorporateSubscriptionRow>(
      `select subscription_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_id,
              package_code, display_name, status, started_at, suspended_at, terminated_at,
              created_by, updated_by, created_at, updated_at
       from corporate_subscriptions
       where corporate_id = $1
         and package_code = $2
         and status = 'active'
       limit 1`,
      [corporateId, packageCode]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [entry] = await this.attachChildren([row]);
    return entry ?? null;
  }

  async createSubscription(payload: SubscriptionCreateRequest) {
    const packageResult = await this.db.query<PackageForSubscriptionRow>(
      `select package_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_code, name,
              owner_type, status, default_debit_mode, default_file_rejection_mode
       from packages
       where package_id = $1
       limit 1`,
      [payload.packageId]
    );

    const packageRow = packageResult.rows[0];
    if (!packageRow) {
      throw new Error("Package not found");
    }

    if (packageRow.status !== "active") {
      throw new Error("Only active packages can be added to a workspace");
    }

    if (packageRow.bank_tenant_id !== payload.bankTenantId) {
      throw new Error("Package does not belong to the selected bank");
    }

    if (
      packageRow.owner_type === "corporate" &&
      (packageRow.corporate_tenant_id !== payload.corporateTenantId ||
        packageRow.corporate_id !== payload.corporateId)
    ) {
      throw new Error("This corporate-owned package belongs to a different workspace");
    }

    const existing = await this.findActiveSubscription(
      payload.corporateId,
      packageRow.package_code
    );

    if (existing) {
      throw new Error("This package is already active in the current workspace");
    }

    const [paymentMethodsResult, debitAccountsResult, packageDebitAccountsResult, usersResult, corporateResult] =
      await Promise.all([
        this.db.query<PackagePaymentMethodRow>(
          `select payment_method_code
           from package_payment_methods
           where package_id = $1
           order by payment_method_code`,
          [packageRow.package_id]
        ),
        this.db.query<DebitAccountSeedRow>(
          `select debit_account_id, is_default
           from corporate_debit_accounts
           where bank_tenant_id = $1
             and corporate_tenant_id = $2
             and corporate_id = $3
             and status = 'active'
           order by is_default desc, account_name, debit_account_id`,
          [payload.bankTenantId, payload.corporateTenantId, payload.corporateId]
        ),
        this.db.query<PackageDebitAccountSeedRow>(
          `select debit_account_id, is_default
           from package_debit_accounts
           where package_id = $1
             and status = 'active'
           order by is_default desc, debit_account_id`,
          [packageRow.package_id]
        ),
        this.db.query<SubscriptionUserSeedRow>(
          `select user_id, role
           from corporate_users
           where bank_tenant_id = $1
             and corporate_tenant_id = $2
             and corporate_id = $3
             and status = 'active'
             and coalesce(approval_state, 'approved') = 'approved'
           order by username`,
          [payload.bankTenantId, payload.corporateTenantId, payload.corporateId]
        ),
        this.db.query<CorporateNameRow>(
          `select name
           from corporates
           where corporate_id = $1
           limit 1`,
          [payload.corporateId]
        )
      ]);

    const allowedPaymentMethodCodes = paymentMethodsResult.rows.map(
      (row) => row.payment_method_code
    );
    const selectedDebitAccounts =
      packageDebitAccountsResult.rows.length > 0
        ? packageDebitAccountsResult.rows
        : debitAccountsResult.rows;
    const defaultDebitAccountId =
      selectedDebitAccounts.find((row) => row.is_default)?.debit_account_id ??
      selectedDebitAccounts[0]?.debit_account_id ??
      null;
    const corporateName = corporateResult.rows[0]?.name?.trim();
    const displayName = corporateName
      ? `${corporateName} ${packageRow.name}`
      : packageRow.name;
    const subscriptionId = `sub-${normalizeCode(payload.corporateId).toLowerCase()}-${normalizeCode(
      packageRow.package_code
    ).toLowerCase()}-${randomUUID().slice(0, 8)}`;

    const client = await this.db.connect();

    try {
      await client.query("begin");

      await client.query(
        `insert into corporate_subscriptions (
           subscription_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_id,
           package_code, display_name, status, started_at, suspended_at, terminated_at,
           created_by, updated_by, created_at, updated_at
         )
         values (
           $1, $2, $3, $4, $5,
           $6, $7, 'active', now(), null, null,
           $8, $8, now(), now()
         )`,
        [
          subscriptionId,
          payload.bankTenantId,
          payload.corporateTenantId,
          payload.corporateId,
          packageRow.package_id,
          packageRow.package_code,
          displayName,
          payload.createdByUserId
        ]
      );

      for (const account of selectedDebitAccounts) {
        await client.query(
          `insert into subscription_debit_accounts (
             subscription_id, debit_account_id, allowed_payment_method_codes, status, is_default,
             created_at
           )
           values ($1, $2, $3::text[], 'active', $4, now())`,
          [
            subscriptionId,
            account.debit_account_id,
            allowedPaymentMethodCodes,
            account.debit_account_id === defaultDebitAccountId
          ]
        );
      }

      await client.query(
        `insert into corporate_subscription_preferences (
           subscription_id, preferred_debit_mode, preferred_file_rejection_mode,
           default_debit_account_id, payment_method_preferences_json, created_at, updated_at
         )
         values ($1, $2, $3, $4, $5::jsonb, now(), now())`,
        [
          subscriptionId,
          packageRow.default_debit_mode,
          packageRow.default_file_rejection_mode,
          defaultDebitAccountId,
          JSON.stringify({
            preferredOrder: allowedPaymentMethodCodes
          })
        ]
      );

      for (const user of usersResult.rows) {
        await client.query(
          `insert into subscription_user_access (
             access_id, subscription_id, user_id, role_name, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, 'active', now(), now())`,
          [
            `sua-${subscriptionId}-${normalizeCode(user.user_id).toLowerCase()}`,
            subscriptionId,
            user.user_id,
            user.role
          ]
        );
      }

      const uniqueRoles = [...new Set(usersResult.rows.map((u) => u.role))];
      for (const roleName of uniqueRoles) {
        const accessId = `rsa-${payload.corporateTenantId}-${normalizeCode(roleName).toLowerCase()}-${subscriptionId}`;
        await client.query(
          `insert into role_subscription_access (
             access_id, corporate_tenant_id, role_name, subscription_id, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, 'active', now(), now())
           on conflict (access_id) do nothing`,
          [
            accessId,
            payload.corporateTenantId,
            roleName,
            subscriptionId
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

    return this.getSubscription(subscriptionId);
  }

  async updateSubscriptionStatus(
    subscriptionId: string,
    payload: SubscriptionStatusUpdateRequest
  ) {
    const existing = await this.getSubscription(subscriptionId);

    if (!existing) {
      return null;
    }

    const nextStatus = payload.status;
    const suspendedAt =
      nextStatus === "suspended"
        ? "now()"
        : nextStatus === "active"
          ? "null"
          : "corporate_subscriptions.suspended_at";
    const terminatedAt =
      nextStatus === "terminated"
        ? "now()"
        : nextStatus === "active"
          ? "null"
          : "corporate_subscriptions.terminated_at";
    const startedAt =
      nextStatus === "active" ? "coalesce(corporate_subscriptions.started_at, now())" : "corporate_subscriptions.started_at";

    await this.db.query(
      `update corporate_subscriptions
       set status = $2,
           started_at = ${startedAt},
           suspended_at = ${suspendedAt},
           terminated_at = ${terminatedAt},
           updated_by = $3,
           updated_at = now()
       where subscription_id = $1`,
      [subscriptionId, nextStatus, payload.actedByUserId]
    );

    return this.getSubscription(subscriptionId);
  }

  async replaceRoleSubscriptionAccess(payload: SubscriptionRoleAccessUpdateRequest) {
    const actorHasPermission = await this.identityAccessService.userHasPermission(
      payload.actedByUserId,
      "settings.edit"
    );
    if (!actorHasPermission) {
      return { error: "forbidden" as const };
    }

    const role = await this.identityAccessService.getCorporateRoleByName(
      payload.corporateTenantId,
      payload.roleName
    );
    if (!role) {
      return { error: "role_not_found" as const };
    }

    const workspaceSubscriptionsResult = await this.db.query<{ subscription_id: string }>(
      `select subscription_id
       from corporate_subscriptions
       where corporate_tenant_id = $1
         and corporate_id = $2
         and status = 'active'
       order by package_code, created_at desc`,
      [payload.corporateTenantId, payload.corporateId]
    );
    const workspaceSubscriptionIds = workspaceSubscriptionsResult.rows.map(
      (row) => row.subscription_id
    );
    const workspaceSubscriptionIdSet = new Set(workspaceSubscriptionIds);
    const selectedSubscriptionIds = [...new Set(payload.subscriptionIds)].filter((subscriptionId) =>
      workspaceSubscriptionIdSet.has(subscriptionId)
    );

    const usersResult = await this.db.query<{ user_id: string }>(
      `select user_id
       from corporate_users
       where corporate_tenant_id = $1
         and corporate_id = $2
         and role = $3
         and status = 'active'
         and coalesce(approval_state, 'approved') = 'approved'
       order by username`,
      [payload.corporateTenantId, payload.corporateId, payload.roleName]
    );
    const userIds = usersResult.rows.map((row) => row.user_id);

    const client = await this.db.connect();
    try {
      await client.query("begin");

      // 1. Manage role_subscription_access
      await client.query(
        `delete from role_subscription_access
         where corporate_tenant_id = $1
           and role_name = $2`,
        [payload.corporateTenantId, payload.roleName]
      );

      for (const subscriptionId of selectedSubscriptionIds) {
        const accessId = `rsa-${payload.corporateTenantId}-${normalizeCode(payload.roleName).toLowerCase()}-${subscriptionId}`;
        await client.query(
          `insert into role_subscription_access (
             access_id, corporate_tenant_id, role_name, subscription_id, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, 'active', now(), now())`,
          [
            accessId,
            payload.corporateTenantId,
            payload.roleName,
            subscriptionId
          ]
        );
      }

      // 2. Manage subscription_user_access (fallback/cache)
      if (workspaceSubscriptionIds.length > 0) {
        await client.query(
          `delete from subscription_user_access
           where subscription_id = any($1::text[])
             and role_name = $2`,
          [workspaceSubscriptionIds, payload.roleName]
        );
      }

      for (const subscriptionId of selectedSubscriptionIds) {
        for (const userId of userIds) {
          await client.query(
            `insert into subscription_user_access (
               access_id, subscription_id, user_id, role_name, status, created_at, updated_at
             )
             values ($1, $2, $3, $4, 'active', now(), now())`,
            [
              `sua-${subscriptionId}-${normalizeCode(userId).toLowerCase()}`,
              subscriptionId,
              userId,
              payload.roleName
            ]
          );
        }
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return {
      data: await this.listSubscriptions({
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId
      })
    };
  }

  private async attachChildren(rows: CorporateSubscriptionRow[]) {
    if (rows.length === 0) {
      return [] as CorporateSubscription[];
    }

    const subscriptionIds = rows.map((row) => row.subscription_id);

    const [debitAccountsResult, userAccessResult] = await Promise.all([
      this.db.query<SubscriptionDebitAccountRow>(
        `select sda.subscription_id, sda.debit_account_id, cda.account_name, cda.account_number,
                cda.ifsc, sda.allowed_payment_method_codes, sda.is_default, sda.status
         from subscription_debit_accounts sda
         join corporate_debit_accounts cda on cda.debit_account_id = sda.debit_account_id
         where sda.subscription_id = any($1::text[])
         order by sda.is_default desc, cda.account_name`,
        [subscriptionIds]
      ),
      this.db.query<SubscriptionUserAccessRow>(
        `select 
           rsa.access_id, 
           rsa.subscription_id, 
           coalesce(cu.user_id, '') as user_id, 
           coalesce(cu.username, '') as username, 
           coalesce(cu.display_name, '') as display_name,
           rsa.role_name, 
           rsa.status
         from role_subscription_access rsa
         left join corporate_users cu 
           on cu.corporate_tenant_id = rsa.corporate_tenant_id 
          and cu.role = rsa.role_name
          and cu.status = 'active'
          and coalesce(cu.approval_state, 'approved') = 'approved'
         where rsa.subscription_id = any($1::text[])
           and rsa.status = 'active'
         order by cu.username, rsa.role_name`,
        [subscriptionIds]
      )
    ]);

    const debitAccountsBySubscription = new Map<string, SubscriptionDebitAccountAccess[]>();
    const userAccessBySubscription = new Map<string, SubscriptionUserAccess[]>();

    for (const row of debitAccountsResult.rows) {
      const items = debitAccountsBySubscription.get(row.subscription_id) ?? [];
      items.push({
        debitAccountId: row.debit_account_id,
        accountName: row.account_name,
        accountNumber: row.account_number,
        ifsc: row.ifsc,
        allowedPaymentMethodCodes: row.allowed_payment_method_codes ?? [],
        isDefault: row.is_default,
        status: row.status
      });
      debitAccountsBySubscription.set(row.subscription_id, items);
    }

    for (const row of userAccessResult.rows) {
      const items = userAccessBySubscription.get(row.subscription_id) ?? [];
      items.push({
        accessId: row.access_id,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        roleName: row.role_name,
        status: row.status
      });
      userAccessBySubscription.set(row.subscription_id, items);
    }

    return rows.map((row) => ({
      subscriptionId: row.subscription_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      packageId: row.package_id,
      packageCode: row.package_code,
      displayName: row.display_name,
      status: row.status,
      startedAt: row.started_at?.toISOString() ?? null,
      suspendedAt: row.suspended_at?.toISOString() ?? null,
      terminatedAt: row.terminated_at?.toISOString() ?? null,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at?.toISOString() ?? null,
      updatedAt: row.updated_at?.toISOString() ?? null,
      debitAccounts: debitAccountsBySubscription.get(row.subscription_id) ?? [],
      userAccess: userAccessBySubscription.get(row.subscription_id) ?? []
    }));
  }
}

function normalizeCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
