import { loadConfig } from "@cmsv01/shared/config";
import { Decimal } from "@cmsv01/shared/decimal";
import { getDatabasePool } from "@cmsv01/shared/db";

import type {
  PackageCatalogEntry,
  PackageCreateRequest,
  PackageUpdateRequest,
  PackagePaymentMethod,
  PaymentMethod,
  PaymentMethodCreateRequest,
  PaymentMethodUpdateRequest
} from "./contracts.js";

type PaymentMethodRow = {
  payment_method_code: string;
  name: string;
  rail_family: string;
  settlement_mode: "real_time" | "batch";
  weekend_support: boolean;
  min_amount: string | null;
  max_amount: string | null;
  cutoff_time: string;
  status: "active" | "inactive";
  created_at: number | null;
  updated_at: number | null;
};

type PackageRow = {
  package_id: string;
  owner_type: "bank" | "corporate";
  bank_tenant_id: string;
  corporate_tenant_id: string | null;
  corporate_id: string | null;
  base_package_code: string | null;
  package_code: string;
  name: string;
  use_case: string;
  description: string | null;
  allowed_beneficiary_types: string[] | null;
  bulk_approve_enabled: boolean;
  debit_modes_allowed: string[] | null;
  default_debit_mode: string;
  file_rejection_modes_allowed: string[] | null;
  default_file_rejection_mode: string;
  default_payment_method_code: string | null;
  default_debit_account_id: string | null;
  max_payments_per_batch: number;
  pricing_defaults_json: Record<string, unknown> | null;
  status: "active" | "inactive";
  created_at: number | null;
  updated_at: number | null;
};

type PackagePaymentMethodRow = {
  package_id: string;
  payment_method_code: string;
  min_amount_override: string | null;
  max_amount_override: string | null;
  pricing_overrides_json: Record<string, unknown> | null;
};

type PackageDebitAccountRow = {
  package_id: string;
  debit_account_id: string;
  is_default: boolean;
};

export class PackageCatalogService {
  private readonly db = getDatabasePool(loadConfig());

  async listPaymentMethods(status?: "active" | "inactive") {
    const result = status
      ? await this.db.query<PaymentMethodRow>(
          `select payment_method_code, name, rail_family, settlement_mode, weekend_support,
                  min_amount, max_amount, cutoff_time, status, created_at, updated_at
           from payment_methods
           where status = $1
           order by payment_method_code`,
          [status]
        )
      : await this.db.query<PaymentMethodRow>(
          `select payment_method_code, name, rail_family, settlement_mode, weekend_support,
                  min_amount, max_amount, cutoff_time, status, created_at, updated_at
           from payment_methods
           order by payment_method_code`
        );

    return result.rows.map(mapPaymentMethodRow);
  }

  async createPaymentMethod(payload: PaymentMethodCreateRequest) {
    const paymentMethodCode = normalizePaymentMethodCode(
      payload.paymentMethodCode || payload.displayName || payload.name || ""
    );
    const existing = await this.db.query<{ payment_method_code: string }>(
      `select payment_method_code
       from payment_methods
       where payment_method_code = $1
       limit 1`,
      [paymentMethodCode]
    );

    if (existing.rows[0]) {
      return {
        error: "payment_method_exists" as const,
        paymentMethodCode
      };
    }

    const result = await this.db.query<PaymentMethodRow>(
      `insert into payment_methods (
         payment_method_code, name, rail_family, settlement_mode, weekend_support,
         min_amount, max_amount, cutoff_time, status, created_at, updated_at
       )
       values ($1, $2, $3, 'batch', false, $4, $5, $6, 'active', (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint)
       returning payment_method_code, name, rail_family, settlement_mode, weekend_support,
                 min_amount, max_amount, cutoff_time, status, created_at, updated_at`,
      [
        paymentMethodCode,
        (payload.displayName || payload.name || "").trim(),
        paymentMethodCode.toLowerCase(),
        payload.minAmount !== null && payload.minAmount !== undefined ? Decimal.fromCents(BigInt(payload.minAmount)).toString() : null,
        payload.maxAmount !== null && payload.maxAmount !== undefined ? Decimal.fromCents(BigInt(payload.maxAmount)).toString() : null,
        payload.cutoffTime
      ]
    );

    return {
      data: mapPaymentMethodRow(result.rows[0])
    };
  }

  async updatePaymentMethod(
    paymentMethodCode: string,
    payload: PaymentMethodUpdateRequest
  ) {
    const normalizedCode = normalizePaymentMethodCode(paymentMethodCode);
    const result = await this.db.query<PaymentMethodRow>(
      `update payment_methods
       set name = $2,
           min_amount = $3,
           max_amount = $4,
           cutoff_time = $5,
           status = $6,
           updated_at = (extract(epoch from now()) * 1000)::bigint
       where payment_method_code = $1
       returning payment_method_code, name, rail_family, settlement_mode, weekend_support,
                 min_amount, max_amount, cutoff_time, status, created_at, updated_at`,
      [
        normalizedCode,
        (payload.displayName || payload.name || "").trim(),
        payload.minAmount !== null && payload.minAmount !== undefined ? Decimal.fromCents(BigInt(payload.minAmount)).toString() : null,
        payload.maxAmount !== null && payload.maxAmount !== undefined ? Decimal.fromCents(BigInt(payload.maxAmount)).toString() : null,
        payload.cutoffTime,
        payload.status
      ]
    );

    const row = result.rows[0];
    if (!row) {
      return {
        error: "payment_method_not_found" as const
      };
    }

    return {
      data: mapPaymentMethodRow(row)
    };
  }

  async listPackages(filters?: {
    ownerType?: "bank" | "corporate";
    bankTenantId?: string;
    corporateTenantId?: string;
    corporateId?: string;
    status?: "active" | "inactive";
  }) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (filters?.ownerType) {
      values.push(filters.ownerType);
      clauses.push(`owner_type = $${values.length}`);
    }

    if (filters?.bankTenantId) {
      values.push(filters.bankTenantId);
      clauses.push(`bank_tenant_id = $${values.length}`);
    }

    if (filters?.corporateTenantId) {
      values.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${values.length}`);
    }

    if (filters?.corporateId) {
      values.push(filters.corporateId);
      clauses.push(`corporate_id = $${values.length}`);
    }

    if (filters?.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const packagesResult = await this.db.query<PackageRow>(
      `select package_id, owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, base_package_code,
              package_code, name, use_case, description,
              allowed_beneficiary_types, bulk_approve_enabled, debit_modes_allowed,
              default_debit_mode, file_rejection_modes_allowed, default_file_rejection_mode,
              default_payment_method_code, default_debit_account_id, max_payments_per_batch, pricing_defaults_json, status, created_at, updated_at
       from packages
       ${whereClause}
       order by package_code`,
      values
    );

    return this.attachPaymentMethods(packagesResult.rows);
  }

  async createPackage(payload: PackageCreateRequest) {
    const packageCode = normalizeCode(payload.packageCode);
    const ownerType = payload.ownerType ?? "corporate";
    const ownerScope = ownerType === "bank"
      ? { corporateTenantId: null, corporateId: null }
      : {
          corporateTenantId: payload.corporateTenantId ?? null,
          corporateId: payload.corporateId ?? null
        };
    const ownerKey =
      ownerType === "bank"
        ? payload.bankTenantId
        : ownerScope.corporateId ?? payload.bankTenantId;
    const packageId = `pkg-${ownerType}-${ownerKey}-${packageCode.toLowerCase()}`;
    const existing = await this.db.query<{ package_id: string }>(
      `select package_id
       from packages
       where owner_type = $1
         and bank_tenant_id = $2
         and coalesce(corporate_id, '') = $3
         and package_code = $4
       limit 1`,
      [ownerType, payload.bankTenantId, ownerScope.corporateId ?? "", packageCode]
    );

    if (existing.rows[0]) {
      return {
        error: "package_exists" as const,
        packageCode
      };
    }

    const availablePaymentMethods = await this.db.query<{ payment_method_code: string }>(
      `select payment_method_code
       from payment_methods
       where payment_method_code = any($1::text[])
         and status = 'active'`,
      [payload.paymentMethodCodes]
    );

    if (availablePaymentMethods.rows.length !== payload.paymentMethodCodes.length) {
      return {
        error: "payment_method_not_found" as const
      };
    }

    const resolvedDefaultDebitMode =
      payload.defaultDebitMode ?? payload.debitModesAllowed[0] ?? "single";
    const resolvedDefaultFileRejectionMode =
      payload.defaultFileRejectionMode ?? payload.fileRejectionModesAllowed[0] ?? "fail_full_file";

    if ((payload.ownerType ?? "corporate") === "corporate" && payload.debitAccountIds.length > 0) {
      const debitAccounts = await this.db.query<{ debit_account_id: string }>(
        `select debit_account_id
         from corporate_debit_accounts
         where bank_tenant_id = $1
           and corporate_tenant_id = $2
           and corporate_id = $3
           and status = 'active'
           and debit_account_id = any($4::text[])`,
        [
          payload.bankTenantId,
          ownerScope.corporateTenantId,
          ownerScope.corporateId,
          payload.debitAccountIds
        ]
      );

      if (debitAccounts.rows.length !== payload.debitAccountIds.length) {
        return {
          error: "debit_account_not_found" as const
        };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into packages (
           package_id, owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, base_package_code,
           package_code, name, use_case, description,
           allowed_beneficiary_types, bulk_approve_enabled, debit_modes_allowed,
           default_debit_mode, file_rejection_modes_allowed, default_file_rejection_mode,
           default_payment_method_code, default_debit_account_id, max_payments_per_batch, pricing_defaults_json, status, created_at, updated_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13::text[], $14, $15::text[], $16,
           $17, $18, $19, $20::jsonb, $21, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint
         )`,
        [
          packageId,
          payload.ownerType,
          payload.bankTenantId,
          ownerScope.corporateTenantId,
          ownerScope.corporateId,
          payload.basePackageCode ?? null,
          packageCode,
          payload.displayName.trim(),
          payload.useCase,
          payload.description?.trim() || null,
          payload.allowedBeneficiaryTypes,
          payload.bulkApproveEnabled,
          payload.debitModesAllowed,
          resolvedDefaultDebitMode,
          payload.fileRejectionModesAllowed,
          resolvedDefaultFileRejectionMode,
          payload.defaultPaymentMethodCode,
          payload.defaultDebitAccountId ?? null,
          payload.maxPaymentsPerBatch,
          JSON.stringify(payload.pricingDefaults),
          payload.status
        ]
      );

      for (const paymentMethodCode of payload.paymentMethodCodes) {
        await client.query(
          `insert into package_payment_methods (
             package_id, payment_method_code, min_amount_override, max_amount_override,
             pricing_overrides_json, created_at
           )
           values ($1, $2, null, null, '{}'::jsonb, (extract(epoch from now()) * 1000)::bigint)`,
          [packageId, paymentMethodCode]
        );
      }

      for (const debitAccountId of payload.debitAccountIds) {
        await client.query(
          `insert into package_debit_accounts (
             package_id, debit_account_id, status, is_default, created_at, updated_at
           )
           values ($1, $2, 'active', $3, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint)`,
          [packageId, debitAccountId, debitAccountId === payload.defaultDebitAccountId]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const created = await this.getPackageByCode(packageCode, {
      ownerType: payload.ownerType ?? "corporate",
      bankTenantId: payload.bankTenantId,
      corporateId: ownerScope.corporateId ?? undefined
    });
    return {
      data: created as PackageCatalogEntry
    };
  }

  async updatePackage(packageId: string, payload: PackageUpdateRequest) {
    const existing = await this.db.query<{ package_id: string }>(
      `select package_id from packages where package_id = $1 limit 1`,
      [packageId]
    );

    const existingPackageId = existing.rows[0]?.package_id;
    if (!existingPackageId) {
      return { error: "package_not_found" as const };
    }

    const availablePaymentMethods = await this.db.query<{ payment_method_code: string }>(
      `select payment_method_code
       from payment_methods
       where payment_method_code = any($1::text[])
         and status = 'active'`,
      [payload.paymentMethodCodes]
    );

    if (availablePaymentMethods.rows.length !== payload.paymentMethodCodes.length) {
      return {
        error: "payment_method_not_found" as const
      };
    }

    const ownerType = payload.ownerType ?? "corporate";
    const resolvedDefaultDebitMode =
      payload.defaultDebitMode ?? payload.debitModesAllowed[0] ?? "single";
    const resolvedDefaultFileRejectionMode =
      payload.defaultFileRejectionMode ?? payload.fileRejectionModesAllowed[0] ?? "fail_full_file";

    if (ownerType === "corporate" && payload.debitAccountIds.length > 0) {
      const debitAccounts = await this.db.query<{ debit_account_id: string }>(
        `select debit_account_id
         from corporate_debit_accounts
         where bank_tenant_id = $1
           and corporate_tenant_id = $2
           and corporate_id = $3
           and status = 'active'
           and debit_account_id = any($4::text[])`,
        [
          payload.bankTenantId,
          payload.corporateTenantId ?? null,
          payload.corporateId ?? null,
          payload.debitAccountIds
        ]
      );

      if (debitAccounts.rows.length !== payload.debitAccountIds.length) {
        return {
          error: "debit_account_not_found" as const
        };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query("begin");
      await client.query(
        `update packages
         set owner_type = $2,
             bank_tenant_id = $3,
             corporate_tenant_id = $4,
             corporate_id = $5,
             name = $6,
             use_case = $7,
             description = $8,
             allowed_beneficiary_types = $9::text[],
             bulk_approve_enabled = $10,
             debit_modes_allowed = $11::text[],
             default_debit_mode = $12,
             file_rejection_modes_allowed = $13::text[],
             default_file_rejection_mode = $14,
             default_payment_method_code = $15,
             default_debit_account_id = $16,
             max_payments_per_batch = $17,
             pricing_defaults_json = $18::jsonb,
             status = $19,
             updated_at = (extract(epoch from now()) * 1000)::bigint
         where package_id = $1`,
        [
          existingPackageId,
          ownerType,
          payload.bankTenantId,
          payload.corporateTenantId ?? null,
          payload.corporateId ?? null,
          payload.displayName.trim(),
          payload.useCase,
          payload.description?.trim() || null,
          payload.allowedBeneficiaryTypes,
          payload.bulkApproveEnabled,
          payload.debitModesAllowed,
          resolvedDefaultDebitMode,
          payload.fileRejectionModesAllowed,
          resolvedDefaultFileRejectionMode,
          payload.defaultPaymentMethodCode,
          payload.defaultDebitAccountId ?? null,
          payload.maxPaymentsPerBatch,
          JSON.stringify(payload.pricingDefaults),
          payload.status
        ]
      );

      await client.query(`delete from package_payment_methods where package_id = $1`, [existingPackageId]);
      await client.query(`delete from package_debit_accounts where package_id = $1`, [existingPackageId]);

      for (const paymentMethodCode of payload.paymentMethodCodes) {
        await client.query(
          `insert into package_payment_methods (
             package_id, payment_method_code, min_amount_override, max_amount_override,
             pricing_overrides_json, created_at
           )
           values ($1, $2, null, null, '{}'::jsonb, (extract(epoch from now()) * 1000)::bigint)`,
          [existingPackageId, paymentMethodCode]
        );
      }

      for (const debitAccountId of payload.debitAccountIds) {
        await client.query(
          `insert into package_debit_accounts (
             package_id, debit_account_id, status, is_default, created_at, updated_at
           )
           values ($1, $2, 'active', $3, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint)`,
          [existingPackageId, debitAccountId, debitAccountId === payload.defaultDebitAccountId]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const updated = await this.getPackageById(existingPackageId);
    return { data: updated as PackageCatalogEntry };
  }

  async getPackageByCode(
    packageCode: string,
    filters?: {
      ownerType?: "bank" | "corporate";
      bankTenantId?: string;
      corporateId?: string;
    }
  ) {
    const clauses = ["package_code = $1"];
    const values: string[] = [packageCode];

    if (filters?.ownerType) {
      values.push(filters.ownerType);
      clauses.push(`owner_type = $${values.length}`);
    }

    if (filters?.bankTenantId) {
      values.push(filters.bankTenantId);
      clauses.push(`bank_tenant_id = $${values.length}`);
    }

    if (filters?.corporateId) {
      values.push(filters.corporateId);
      clauses.push(`corporate_id = $${values.length}`);
    }

    const result = await this.db.query<PackageRow>(
      `select package_id, owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, base_package_code,
              package_code, name, use_case, description,
              allowed_beneficiary_types, bulk_approve_enabled, debit_modes_allowed,
              default_debit_mode, file_rejection_modes_allowed, default_file_rejection_mode,
              default_payment_method_code, default_debit_account_id, max_payments_per_batch, pricing_defaults_json, status, created_at, updated_at
       from packages
       where ${clauses.join(" and ")}
       limit 1`,
      values
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [entry] = await this.attachPaymentMethods([row]);
    return entry ?? null;
  }

  async getPackageById(packageId: string) {
    const result = await this.db.query<PackageRow>(
      `select package_id, owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, base_package_code,
              package_code, name, use_case, description,
              allowed_beneficiary_types, bulk_approve_enabled, debit_modes_allowed,
              default_debit_mode, file_rejection_modes_allowed, default_file_rejection_mode,
              default_payment_method_code, default_debit_account_id, max_payments_per_batch, pricing_defaults_json, status, created_at, updated_at
       from packages
       where package_id = $1
       limit 1`,
      [packageId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [entry] = await this.attachPaymentMethods([row]);
    return entry ?? null;
  }

  private async attachPaymentMethods(rows: PackageRow[]) {
    if (rows.length === 0) {
      return [] as PackageCatalogEntry[];
    }

    const packageIds = rows.map((row) => row.package_id);
    const result = await this.db.query<PackagePaymentMethodRow>(
      `select package_id, payment_method_code, min_amount_override, max_amount_override,
              pricing_overrides_json
       from package_payment_methods
       where package_id = any($1::text[])
       order by payment_method_code`,
      [packageIds]
    );

    const debitAccountResult = await this.db.query<PackageDebitAccountRow>(
      `select package_id, debit_account_id, is_default
       from package_debit_accounts
       where package_id = any($1::text[])
         and status = 'active'
       order by debit_account_id`,
      [packageIds]
    );

    const paymentMethodsByPackage = new Map<string, PackagePaymentMethod[]>();
    const debitAccountsByPackage = new Map<string, string[]>();
    const defaultDebitAccountIdByPackage = new Map<string, string | null>();

    for (const row of result.rows) {
      const existing = paymentMethodsByPackage.get(row.package_id) ?? [];
      existing.push({
        paymentMethodCode: row.payment_method_code,
        minAmountOverride: row.min_amount_override ? Number(Decimal.fromString(row.min_amount_override).toCents()) : null,
        maxAmountOverride: row.max_amount_override ? Number(Decimal.fromString(row.max_amount_override).toCents()) : null,
        pricingOverrides: row.pricing_overrides_json ?? {}
      });
      paymentMethodsByPackage.set(row.package_id, existing);
    }

    for (const row of debitAccountResult.rows) {
      const existing = debitAccountsByPackage.get(row.package_id) ?? [];
      existing.push(row.debit_account_id);
      debitAccountsByPackage.set(row.package_id, existing);
      if (row.is_default) {
        defaultDebitAccountIdByPackage.set(row.package_id, row.debit_account_id);
      }
    }

    return rows.map((row) => ({
      packageId: row.package_id,
      ownerType: row.owner_type,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      basePackageCode: row.base_package_code,
      packageCode: row.package_code,
      name: row.name,
      useCase: row.use_case,
      description: row.description,
      allowedBeneficiaryTypes: row.allowed_beneficiary_types ?? [],
      bulkApproveEnabled: row.bulk_approve_enabled,
      debitModesAllowed: row.debit_modes_allowed ?? [],
      defaultDebitMode: row.default_debit_mode,
      fileRejectionModesAllowed: row.file_rejection_modes_allowed ?? [],
      defaultFileRejectionMode: row.default_file_rejection_mode,
      defaultPaymentMethodCode: row.default_payment_method_code,
      debitAccountIds: debitAccountsByPackage.get(row.package_id) ?? [],
      defaultDebitAccountId:
        defaultDebitAccountIdByPackage.get(row.package_id) ?? row.default_debit_account_id ?? null,
      maxPaymentsPerBatch: row.max_payments_per_batch,
      pricingDefaults: row.pricing_defaults_json ?? {},
      status: row.status,
      paymentMethods: paymentMethodsByPackage.get(row.package_id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

function mapPaymentMethodRow(row: PaymentMethodRow) {
  return {
    paymentMethodCode: row.payment_method_code,
    displayName: row.name,
    name: row.name,
    railFamily: row.rail_family,
    settlementMode: row.settlement_mode,
    weekendSupport: row.weekend_support,
    minAmount: row.min_amount ? Number(Decimal.fromString(row.min_amount).toCents()) : null,
    maxAmount: row.max_amount ? Number(Decimal.fromString(row.max_amount).toCents()) : null,
    cutoffTime: row.cutoff_time,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } satisfies PaymentMethod;
}

function normalizePaymentMethodCode(value: string) {
  return normalizeCode(value);
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
