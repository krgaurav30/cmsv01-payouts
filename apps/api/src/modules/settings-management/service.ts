import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import { IdentityAccessService } from "../identity-access/service.js";

import type {
  CorporateTenantSettings,
  CorporateTenantSettingsRequest
} from "./contracts.js";

type CorporateTenantSettingsRow = {
  corporate_tenant_id: string;
  company_display_name: string;
  support_email: string | null;
  support_phone: string | null;
  registered_address: string | null;
  default_approval_note_template: string | null;
  max_single_transaction_amount: string;
  max_daily_cumulative_transaction_amount: string;
  max_bulk_upload_rows: number;
  duplicate_reference_policy: string;
  updated_at: Date | null;
  updated_by_user_id: string | null;
  updated_by_role: string | null;
};

const DEFAULT_SINGLE_LIMIT = 500_000;
const DEFAULT_DAILY_LIMIT = 5_000_000;
const DEFAULT_BULK_ROWS = 100;

export class SettingsManagementService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly identityAccessService = new IdentityAccessService(loadConfig())
  ) {}

  async getSettingsForCorporateTenant(corporateTenantId: string) {
    const result = await this.db.query<CorporateTenantSettingsRow>(
      `select corporate_tenant_id, company_display_name, support_email, support_phone,
              registered_address, default_approval_note_template,
              max_single_transaction_amount, max_daily_cumulative_transaction_amount,
              max_bulk_upload_rows, duplicate_reference_policy, updated_at,
              updated_by_user_id, updated_by_role
       from corporate_tenant_settings
       where corporate_tenant_id = $1`,
      [corporateTenantId]
    );

    const row = result.rows[0];
    if (row) {
      return mapSettingsRow(row);
    }

    const tenantResult = await this.db.query<{ tenant_id: string; name: string }>(
      `select tenant_id, name from corporate_tenants where tenant_id = $1`,
      [corporateTenantId]
    );

    const tenant = tenantResult.rows[0];
    if (!tenant) {
      return null;
    }

    return {
      corporateTenantId,
      companyDisplayName: tenant.name,
      supportEmail: null,
      supportPhone: null,
      registeredAddress: null,
      defaultApprovalNoteTemplate: "Submitted by maker for checker approval",
      maxSingleTransactionAmount: DEFAULT_SINGLE_LIMIT,
      maxDailyCumulativeTransactionAmount: DEFAULT_DAILY_LIMIT,
      maxBulkUploadRows: DEFAULT_BULK_ROWS,
      duplicateReferencePolicy: "enabled",
      updatedAt: null,
      updatedByUserId: null,
      updatedByRole: null
    } satisfies CorporateTenantSettings;
  }

  async getSettingsForView(corporateTenantId: string, actedByUserId: string) {
    const canView = await this.identityAccessService.userHasPermission(
      actedByUserId,
      "settings.view"
    );

    if (!canView) {
      return { error: "forbidden" as const };
    }

    const settings = await this.getSettingsForCorporateTenant(corporateTenantId);
    if (!settings) {
      return { error: "tenant_not_found" as const };
    }

    return { data: settings };
  }

  async upsertSettings(payload: CorporateTenantSettingsRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    const canEdit = await this.identityAccessService.userHasPermission(
      payload.actedByUserId,
      "settings.edit"
    );

    if (!actor || !canEdit) {
      return { error: "forbidden" as const };
    }

    const tenantResult = await this.db.query<{ tenant_id: string }>(
      `select tenant_id from corporate_tenants where tenant_id = $1`,
      [payload.corporateTenantId]
    );

    if (!tenantResult.rows[0]) {
      return { error: "tenant_not_found" as const };
    }

    const result = await this.db.query<CorporateTenantSettingsRow>(
      `insert into corporate_tenant_settings (
         corporate_tenant_id, company_display_name, support_email, support_phone,
         registered_address, default_approval_note_template,
         max_single_transaction_amount, max_daily_cumulative_transaction_amount,
         max_bulk_upload_rows, duplicate_reference_policy, updated_at,
         updated_by_user_id, updated_by_role
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11, $12)
       on conflict (corporate_tenant_id) do update
       set company_display_name = excluded.company_display_name,
           support_email = excluded.support_email,
           support_phone = excluded.support_phone,
           registered_address = excluded.registered_address,
           default_approval_note_template = excluded.default_approval_note_template,
           max_single_transaction_amount = excluded.max_single_transaction_amount,
           max_daily_cumulative_transaction_amount = excluded.max_daily_cumulative_transaction_amount,
           max_bulk_upload_rows = excluded.max_bulk_upload_rows,
           duplicate_reference_policy = excluded.duplicate_reference_policy,
           updated_at = now(),
           updated_by_user_id = excluded.updated_by_user_id,
           updated_by_role = excluded.updated_by_role
       returning corporate_tenant_id, company_display_name, support_email, support_phone,
                 registered_address, default_approval_note_template,
                 max_single_transaction_amount, max_daily_cumulative_transaction_amount,
                 max_bulk_upload_rows, duplicate_reference_policy, updated_at,
                 updated_by_user_id, updated_by_role`,
      [
        payload.corporateTenantId,
        payload.companyDisplayName,
        normalizeOptional(payload.supportEmail),
        normalizeOptional(payload.supportPhone),
        normalizeOptional(payload.registeredAddress),
        normalizeOptional(payload.defaultApprovalNoteTemplate),
        payload.maxSingleTransactionAmount,
        payload.maxDailyCumulativeTransactionAmount,
        payload.maxBulkUploadRows,
        payload.duplicateReferencePolicy,
        payload.actedByUserId,
        actor.role
      ]
    );

    return { data: mapSettingsRow(result.rows[0]) };
  }
}

function mapSettingsRow(row: CorporateTenantSettingsRow) {
  return {
    corporateTenantId: row.corporate_tenant_id,
    companyDisplayName: row.company_display_name,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    registeredAddress: row.registered_address,
    defaultApprovalNoteTemplate: row.default_approval_note_template,
    maxSingleTransactionAmount: Number(row.max_single_transaction_amount),
    maxDailyCumulativeTransactionAmount: Number(
      row.max_daily_cumulative_transaction_amount
    ),
    maxBulkUploadRows: row.max_bulk_upload_rows,
    duplicateReferencePolicy:
      row.duplicate_reference_policy === "disabled" ? "disabled" : "enabled",
    updatedAt: row.updated_at?.toISOString() ?? null,
    updatedByUserId: row.updated_by_user_id,
    updatedByRole: row.updated_by_role
  } satisfies CorporateTenantSettings;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
