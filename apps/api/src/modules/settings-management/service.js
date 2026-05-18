import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { IdentityAccessService } from "../identity-access/service.js";
const DEFAULT_SINGLE_LIMIT = 500_000;
const DEFAULT_DAILY_LIMIT = 5_000_000;
const DEFAULT_BULK_ROWS = 100;
export class SettingsManagementService {
    identityAccessService;
    db = getDatabasePool(loadConfig());
    constructor(identityAccessService = new IdentityAccessService(loadConfig())) {
        this.identityAccessService = identityAccessService;
    }
    async getSettingsForCorporateTenant(corporateTenantId) {
        const result = await this.db.query(`select corporate_tenant_id, company_display_name, support_email, support_phone,
              registered_address, default_approval_note_template,
              max_single_transaction_amount, max_daily_cumulative_transaction_amount,
              max_bulk_upload_rows, duplicate_reference_policy, updated_at,
              updated_by_user_id, updated_by_role
       from corporate_tenant_settings
       where corporate_tenant_id = $1`, [corporateTenantId]);
        const row = result.rows[0];
        if (row) {
            return mapSettingsRow(row);
        }
        const tenantResult = await this.db.query(`select tenant_id, name from corporate_tenants where tenant_id = $1`, [corporateTenantId]);
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
        };
    }
    async getSettingsForView(corporateTenantId, actedByUserId) {
        const canView = await this.identityAccessService.userHasPermission(actedByUserId, "settings.view");
        if (!canView) {
            return { error: "forbidden" };
        }
        const settings = await this.getSettingsForCorporateTenant(corporateTenantId);
        if (!settings) {
            return { error: "tenant_not_found" };
        }
        return { data: settings };
    }
    async upsertSettings(payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
        const canEdit = await this.identityAccessService.userHasPermission(payload.actedByUserId, "settings.edit");
        if (!actor || !canEdit) {
            return { error: "forbidden" };
        }
        const tenantResult = await this.db.query(`select tenant_id from corporate_tenants where tenant_id = $1`, [payload.corporateTenantId]);
        if (!tenantResult.rows[0]) {
            return { error: "tenant_not_found" };
        }
        const result = await this.db.query(`insert into corporate_tenant_settings (
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
                 updated_by_user_id, updated_by_role`, [
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
        ]);
        return { data: mapSettingsRow(result.rows[0]) };
    }
}
function mapSettingsRow(row) {
    return {
        corporateTenantId: row.corporate_tenant_id,
        companyDisplayName: row.company_display_name,
        supportEmail: row.support_email,
        supportPhone: row.support_phone,
        registeredAddress: row.registered_address,
        defaultApprovalNoteTemplate: row.default_approval_note_template,
        maxSingleTransactionAmount: Number(row.max_single_transaction_amount),
        maxDailyCumulativeTransactionAmount: Number(row.max_daily_cumulative_transaction_amount),
        maxBulkUploadRows: row.max_bulk_upload_rows,
        duplicateReferencePolicy: row.duplicate_reference_policy === "disabled" ? "disabled" : "enabled",
        updatedAt: row.updated_at?.toISOString() ?? null,
        updatedByUserId: row.updated_by_user_id,
        updatedByRole: row.updated_by_role
    };
}
function normalizeOptional(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
