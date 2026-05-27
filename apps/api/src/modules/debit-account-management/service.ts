import { randomUUID } from "node:crypto";

import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import { IdentityAccessService } from "../identity-access/service.js";

import type {
  CorporateDebitAccount,
  DebitAccountCreateRequest,
  DebitAccountUpdateRequest,
  SubscriptionDebitAccountAccessUpdateRequest
} from "./contracts.js";

type CorporateDebitAccountRow = {
  debit_account_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  is_default: boolean;
  status: "active" | "inactive";
  balance: string;
  created_at: number | null;
  updated_at: number | null;
};

type SubscriptionScopeRow = {
  subscription_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string;
  package_id: string;
};

type PackagePaymentMethodRow = {
  payment_method_code: string;
};

export class DebitAccountManagementService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly identityAccessService = new IdentityAccessService(loadConfig())
  ) {}

  async listCorporateDebitAccounts(filters: {
    bankTenantId?: string;
    corporateTenantId?: string;
    corporateId?: string;
    status?: "active" | "inactive";
  }) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (filters.bankTenantId) {
      values.push(filters.bankTenantId);
      clauses.push(`bank_tenant_id = $${values.length}`);
    }

    if (filters.corporateTenantId) {
      values.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${values.length}`);
    }

    if (filters.corporateId) {
      values.push(filters.corporateId);
      clauses.push(`corporate_id = $${values.length}`);
    }

    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query<CorporateDebitAccountRow>(
      `select debit_account_id, bank_tenant_id, corporate_tenant_id, corporate_id,
              account_name, account_number, ifsc, is_default, status, balance, created_at, updated_at
       from corporate_debit_accounts
       ${whereClause}
       order by is_default desc, account_name asc, debit_account_id asc`,
      values
    );

    return result.rows.map(mapCorporateDebitAccountRow);
  }

  async createDebitAccount(payload: DebitAccountCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.identityAccessService.userHasPermission(payload.actedByUserId, "settings.edit"))) {
      return { error: "forbidden" as const };
    }

    const normalizedAccountNumber = payload.accountNumber.trim();
    const duplicate = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from corporate_debit_accounts
       where corporate_id = $1
         and account_number = $2
       limit 1`,
      [payload.corporateId, normalizedAccountNumber]
    );

    if (duplicate.rows[0]) {
      return {
        error: "duplicate_account_number" as const,
        debitAccountId: duplicate.rows[0].debit_account_id
      };
    }

    const existingAccounts = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from corporate_debit_accounts
       where bank_tenant_id = $1
         and corporate_tenant_id = $2
         and corporate_id = $3
         and status = 'active'`,
      [payload.bankTenantId, payload.corporateTenantId, payload.corporateId]
    );

    const debitAccountId = `da-${normalizeCode(payload.corporateId).toLowerCase()}-${randomUUID().slice(0, 8)}`;
    const shouldBeDefault = payload.isDefault || existingAccounts.rows.length === 0;
    const client = await this.db.connect();

    try {
      await client.query("begin");

      if (shouldBeDefault) {
        await client.query(
          `update corporate_debit_accounts
           set is_default = false,
               updated_at = (extract(epoch from now()) * 1000)::bigint
           where bank_tenant_id = $1
             and corporate_tenant_id = $2
             and corporate_id = $3`,
          [payload.bankTenantId, payload.corporateTenantId, payload.corporateId]
        );
      }

      const initialBalance = payload.initialBalance !== undefined ? payload.initialBalance : 10000000.00;

      await client.query(
        `insert into corporate_debit_accounts (
           debit_account_id, bank_tenant_id, corporate_tenant_id, corporate_id, account_name,
           account_number, ifsc, status, is_default, balance, created_at, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint)`,
        [
          debitAccountId,
          payload.bankTenantId,
          payload.corporateTenantId,
          payload.corporateId,
          payload.accountName.trim(),
          normalizedAccountNumber,
          payload.ifsc.trim().toUpperCase(),
          shouldBeDefault,
          initialBalance
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return {
      data: await this.getDebitAccount(debitAccountId)
    };
  }

  async updateDebitAccount(debitAccountId: string, payload: DebitAccountUpdateRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.identityAccessService.userHasPermission(payload.actedByUserId, "settings.edit"))) {
      return { error: "forbidden" as const };
    }

    const existing = await this.getDebitAccount(debitAccountId);
    if (!existing) {
      return { error: "debit_account_not_found" as const };
    }

    const duplicate = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from corporate_debit_accounts
       where corporate_id = $1
         and account_number = $2
         and debit_account_id <> $3
       limit 1`,
      [existing.corporateId, payload.accountNumber.trim(), debitAccountId]
    );

    if (duplicate.rows[0]) {
      return {
        error: "duplicate_account_number" as const,
        debitAccountId: duplicate.rows[0].debit_account_id
      };
    }

    const client = await this.db.connect();
    try {
      await client.query("begin");

      if (payload.isDefault && payload.status === "active") {
        await client.query(
          `update corporate_debit_accounts
           set is_default = false,
               updated_at = (extract(epoch from now()) * 1000)::bigint
           where bank_tenant_id = $1
             and corporate_tenant_id = $2
             and corporate_id = $3`,
          [existing.bankTenantId, existing.corporateTenantId, existing.corporateId]
        );
      }

      await client.query(
        `update corporate_debit_accounts
         set account_name = $2,
             account_number = $3,
             ifsc = $4,
             status = $5,
             is_default = $6,
             updated_at = (extract(epoch from now()) * 1000)::bigint
         where debit_account_id = $1`,
        [
          debitAccountId,
          payload.accountName.trim(),
          payload.accountNumber.trim(),
          payload.ifsc.trim().toUpperCase(),
          payload.status,
          payload.isDefault && payload.status === "active"
        ]
      );

      if (payload.status === "inactive" && existing.isDefault) {
        await this.promoteFallbackDefault(
          existing.bankTenantId,
          existing.corporateTenantId,
          existing.corporateId,
          client
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
      data: await this.getDebitAccount(debitAccountId)
    };
  }

  async updateSubscriptionDebitAccountAccess(
    subscriptionId: string,
    payload: SubscriptionDebitAccountAccessUpdateRequest
  ) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    if (!actor || !(await this.identityAccessService.userHasPermission(payload.actedByUserId, "settings.edit"))) {
      return { error: "forbidden" as const };
    }

    const subscriptionResult = await this.db.query<SubscriptionScopeRow>(
      `select subscription_id, bank_tenant_id, corporate_tenant_id, corporate_id, package_id
       from corporate_subscriptions
       where subscription_id = $1
       limit 1`,
      [subscriptionId]
    );

    const subscription = subscriptionResult.rows[0];
    if (!subscription) {
      return { error: "subscription_not_found" as const };
    }

    const normalizedIds = [...new Set(payload.debitAccountIds)];
    if (!normalizedIds.includes(payload.defaultDebitAccountId)) {
      return { error: "default_account_not_allowed" as const };
    }

    const accountsResult = await this.db.query<{ debit_account_id: string }>(
      `select debit_account_id
       from corporate_debit_accounts
       where bank_tenant_id = $1
         and corporate_tenant_id = $2
         and corporate_id = $3
         and status = 'active'
         and debit_account_id = any($4::text[])`,
      [
        subscription.bank_tenant_id,
        subscription.corporate_tenant_id,
        subscription.corporate_id,
        normalizedIds
      ]
    );

    if (accountsResult.rows.length !== normalizedIds.length) {
      return { error: "debit_account_not_found" as const };
    }

    const packageMethodsResult = await this.db.query<PackagePaymentMethodRow>(
      `select payment_method_code
       from package_payment_methods
       where package_id = $1
       order by payment_method_code`,
      [subscription.package_id]
    );
    const allowedPaymentMethodCodes = packageMethodsResult.rows.map((row) => row.payment_method_code);

    const client = await this.db.connect();
    try {
      await client.query("begin");

      await client.query(
        `delete from subscription_debit_accounts where subscription_id = $1`,
        [subscriptionId]
      );

      for (const debitAccountId of normalizedIds) {
        await client.query(
          `insert into subscription_debit_accounts (
             subscription_id, debit_account_id, allowed_payment_method_codes, status, is_default, created_at
           )
           values ($1, $2, $3::text[], 'active', $4, (extract(epoch from now()) * 1000)::bigint)`,
          [
            subscriptionId,
            debitAccountId,
            allowedPaymentMethodCodes,
            debitAccountId === payload.defaultDebitAccountId
          ]
        );
      }

      await client.query(
        `insert into corporate_subscription_preferences (
           subscription_id, preferred_debit_mode, preferred_file_rejection_mode,
           default_debit_account_id, payment_method_preferences_json, created_at, updated_at
         )
         values ($1, null, null, $2, '{}'::jsonb, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint)
         on conflict (subscription_id) do update
         set default_debit_account_id = excluded.default_debit_account_id,
             updated_at = (extract(epoch from now()) * 1000)::bigint`,
        [subscriptionId, payload.defaultDebitAccountId]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return { data: true as const };
  }

  private async getDebitAccount(debitAccountId: string) {
    const result = await this.db.query<CorporateDebitAccountRow>(
      `select debit_account_id, bank_tenant_id, corporate_tenant_id, corporate_id,
              account_name, account_number, ifsc, is_default, status, balance, created_at, updated_at
       from corporate_debit_accounts
       where debit_account_id = $1
       limit 1`,
      [debitAccountId]
    );

    const row = result.rows[0];
    return row ? mapCorporateDebitAccountRow(row) : null;
  }

  private async promoteFallbackDefault(
    bankTenantId: string,
    corporateTenantId: string,
    corporateId: string,
    executor: { query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> }
  ) {
    const fallbackResult = await executor.query<{ debit_account_id: string }>(
      `select debit_account_id
       from corporate_debit_accounts
       where bank_tenant_id = $1
         and corporate_tenant_id = $2
         and corporate_id = $3
         and status = 'active'
       order by updated_at desc, debit_account_id asc
       limit 1`,
      [bankTenantId, corporateTenantId, corporateId]
    );

    const fallback = fallbackResult.rows[0];
    if (!fallback) {
      return;
    }

    await executor.query(
      `update corporate_debit_accounts
       set is_default = true,
           updated_at = (extract(epoch from now()) * 1000)::bigint
       where debit_account_id = $1`,
      [fallback.debit_account_id]
    );
  }
}

function mapCorporateDebitAccountRow(row: CorporateDebitAccountRow) {
  return {
    debitAccountId: row.debit_account_id,
    bankTenantId: row.bank_tenant_id,
    corporateTenantId: row.corporate_tenant_id,
    corporateId: row.corporate_id,
    accountName: row.account_name,
    accountNumber: row.account_number,
    ifsc: row.ifsc,
    isDefault: row.is_default,
    status: row.status,
    balance: String(row.balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } satisfies CorporateDebitAccount;
}

function normalizeCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
