import { PackageCatalogService } from "../package-catalog/service.js";
import { SubscriptionManagementService } from "../subscription-management/service.js";

import type { EffectivePackagePaymentMethod, EffectiveSettingsSnapshot } from "./contracts.js";

type SubscriptionOverrideRow = {
  setting_key: string;
  override_value_json: unknown;
};

type SubscriptionPreferenceRow = {
  preferred_debit_mode: string | null;
  preferred_file_rejection_mode: string | null;
  default_debit_account_id: string | null;
};

import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

export class EffectiveSettingsResolverService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly packageCatalogService = new PackageCatalogService(),
    private readonly subscriptionManagementService = new SubscriptionManagementService()
  ) {}

  async resolveForCorporatePackage(corporateId: string, packageCode: string) {
    const subscription = await this.subscriptionManagementService.findActiveSubscription(
      corporateId,
      packageCode
    );

    if (!subscription) {
      return { error: "subscription_not_found" as const };
    }

    return this.resolveForSubscription(subscription.subscriptionId);
  }

  async resolveForSubscription(subscriptionId: string) {
    const subscription = await this.subscriptionManagementService.getSubscription(subscriptionId);

    if (!subscription) {
      return { error: "subscription_not_found" as const };
    }

    const pkg = await this.packageCatalogService.getPackageByCode(subscription.packageCode);
    if (!pkg) {
      return { error: "package_not_found" as const };
    }

    const [overridesResult, preferencesResult] = await Promise.all([
      this.db.query<SubscriptionOverrideRow>(
        `select setting_key, override_value_json
         from subscription_overrides
         where subscription_id = $1
           and status = 'active'
           and (
             effective_until is null
             or effective_until > (extract(epoch from now()) * 1000)::bigint
           )
         order by created_at desc`,
        [subscriptionId]
      ),
      this.db.query<SubscriptionPreferenceRow>(
        `select preferred_debit_mode, preferred_file_rejection_mode, default_debit_account_id
         from corporate_subscription_preferences
         where subscription_id = $1
         limit 1`,
        [subscriptionId]
      )
    ]);

    const overrideMap = new Map<string, unknown>();
    for (const row of overridesResult.rows) {
      if (!overrideMap.has(row.setting_key)) {
        overrideMap.set(row.setting_key, row.override_value_json);
      }
    }

    const preferences = preferencesResult.rows[0];
    const defaultDebitMode = readStringOverride(
      overrideMap,
      "default_debit_mode",
      pkg.defaultDebitMode
    );
    const debitModesAllowed = readStringArrayOverride(
      overrideMap,
      "debit_modes_allowed",
      pkg.debitModesAllowed
    );
    const defaultFileRejectionMode = readStringOverride(
      overrideMap,
      "default_file_rejection_mode",
      pkg.defaultFileRejectionMode
    );
    const fileRejectionModesAllowed = readStringArrayOverride(
      overrideMap,
      "file_rejection_modes_allowed",
      pkg.fileRejectionModesAllowed
    );
    const allowedBeneficiaryTypes = readStringArrayOverride(
      overrideMap,
      "allowed_beneficiary_types",
      pkg.allowedBeneficiaryTypes
    );
    const maxPaymentsPerBatch = readNumberOverride(
      overrideMap,
      "max_payments_per_batch",
      pkg.maxPaymentsPerBatch
    );
    const bulkApproveEnabled = readBooleanOverride(
      overrideMap,
      "bulk_approve_enabled",
      pkg.bulkApproveEnabled
    );

    const paymentMethods = pkg.paymentMethods.map((item) =>
      applyPaymentMethodOverrides(item, overrideMap)
    );

    return {
      data: {
        subscriptionId: subscription.subscriptionId,
        corporateId: subscription.corporateId,
        corporateTenantId: subscription.corporateTenantId,
        bankTenantId: subscription.bankTenantId,
        packageId: pkg.packageId,
        packageCode: pkg.packageCode,
        subscriptionStatus: subscription.status,
        allowedBeneficiaryTypes,
        bulkApproveEnabled,
        debitModesAllowed,
        defaultDebitMode,
        effectiveDebitMode:
          preferences?.preferred_debit_mode &&
          debitModesAllowed.includes(preferences.preferred_debit_mode)
            ? preferences.preferred_debit_mode
            : defaultDebitMode,
        fileRejectionModesAllowed,
        defaultFileRejectionMode,
        effectiveFileRejectionMode:
          preferences?.preferred_file_rejection_mode &&
          fileRejectionModesAllowed.includes(preferences.preferred_file_rejection_mode)
            ? preferences.preferred_file_rejection_mode
            : defaultFileRejectionMode,
        maxPaymentsPerBatch,
        paymentMethods,
        defaultPaymentMethodCode: pkg.defaultPaymentMethodCode ?? null,
        defaultDebitAccountId: preferences?.default_debit_account_id ?? null,
        activeOverrideKeys: [...overrideMap.keys()]
      } satisfies EffectiveSettingsSnapshot
    };
  }
}

function readStringOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: string
) {
  const value = overrides.get(key);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readStringArrayOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: string[]
) {
  const value = overrides.get(key);
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : fallback;
}

function readNumberOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: number
) {
  const value = overrides.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBooleanOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = overrides.get(key);
  return typeof value === "boolean" ? value : fallback;
}

function applyPaymentMethodOverrides(
  item: {
    paymentMethodCode: string;
    minAmountOverride: number | null;
    maxAmountOverride: number | null;
    pricingOverrides: Record<string, unknown>;
  },
  overrides: Map<string, unknown>
) {
  const prefix = `payment_method.${item.paymentMethodCode}.`;

  return {
    paymentMethodCode: item.paymentMethodCode,
    minAmount: readNullableNumberOverride(
      overrides,
      `${prefix}min_amount`,
      item.minAmountOverride
    ),
    maxAmount: readNullableNumberOverride(
      overrides,
      `${prefix}max_amount`,
      item.maxAmountOverride
    ),
    pricing: readObjectOverride(
      overrides,
      `${prefix}pricing`,
      item.pricingOverrides
    )
  } satisfies EffectivePackagePaymentMethod;
}

function readNullableNumberOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: number | null
) {
  const value = overrides.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readObjectOverride(
  overrides: Map<string, unknown>,
  key: string,
  fallback: Record<string, unknown>
) {
  const value = overrides.get(key);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fallback;
}
