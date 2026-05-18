import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import { TenantManagementService } from "../tenant-management/service.js";

import type {
  OnboardingApplication,
  OnboardingApplicationCreateRequest,
  OnboardingReviewActionRequest
} from "./contracts.js";

export class CorporateOnboardingService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly tenantManagementService = new TenantManagementService()
  ) {}

  async listApplications(bankTenantId?: string, corporateTenantId?: string) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (bankTenantId) {
      values.push(bankTenantId);
      clauses.push(`bank_tenant_id = $${values.length}`);
    }

    if (corporateTenantId) {
      values.push(corporateTenantId);
      clauses.push(`corporate_tenant_id = $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query(
      `select application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
              registered_address, primary_corporate_admin_email, state, review_comment
       from onboarding_applications
       ${whereClause}
       order by application_id`,
      values
    );

    return result.rows.map(mapOnboardingRow) satisfies OnboardingApplication[];
  }

  async getApplication(applicationId: string) {
    const result = await this.db.query(
      `select application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
              registered_address, primary_corporate_admin_email, state, review_comment
       from onboarding_applications
       where application_id = $1`,
      [applicationId]
    );

    const row = result.rows[0];
    return row ? mapOnboardingRow(row) : null;
  }

  async createApplication(payload: OnboardingApplicationCreateRequest) {
    const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);

    if (!bankTenant) {
      return {
        error: "bank_not_found" as const
      };
    }

    let corporateTenantId = payload.corporateTenantId ?? null;
    const corporateTenantName = payload.corporateTenantName ?? null;

    if (payload.onboardingMode === "new_corporate_under_existing_tenant") {
      const corporateTenant = corporateTenantId
        ? await this.tenantManagementService.getCorporateTenant(corporateTenantId)
        : null;

      if (!corporateTenant || corporateTenant.status !== "active") {
        return {
          error: "corporate_not_found" as const
        };
      }
    } else {
      corporateTenantId = this.generateCorporateTenantId(
        payload.corporateTenantName ?? payload.legalEntityName
      );

      await this.tenantManagementService.createCorporateTenant(
        {
          tenantId: corporateTenantId,
          bankTenantId: payload.bankTenantId,
          name: payload.corporateTenantName ?? payload.legalEntityName,
          legalEntityName:
            payload.corporateTenantName ?? payload.legalEntityName,
          corporateAdminEmail: payload.primaryCorporateAdminEmail
        },
        "onboarding"
      );
    }

    const applicationId = this.generateApplicationId(payload.bankTenantId);

    const result = await this.db.query(
      `insert into onboarding_applications (
         application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
         registered_address, primary_corporate_admin_email, state, review_comment
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, 'submitted', null)
       on conflict (application_id) do update
       set onboarding_mode = excluded.onboarding_mode,
           bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_tenant_name = excluded.corporate_tenant_name,
           legal_entity_name = excluded.legal_entity_name,
           signatory_name = excluded.signatory_name,
           gstin = excluded.gstin,
           pan = excluded.pan,
           cin = excluded.cin,
           registered_address = excluded.registered_address,
           primary_corporate_admin_email = excluded.primary_corporate_admin_email
       returning application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
                 registered_address, primary_corporate_admin_email, state, review_comment`,
      [
        applicationId,
        payload.onboardingMode,
        payload.bankTenantId,
        corporateTenantId,
        corporateTenantName,
        payload.legalEntityName,
        payload.signatoryName,
        payload.gstin ?? null,
        payload.pan,
        payload.registeredAddress,
        payload.primaryCorporateAdminEmail
      ]
    );

    return {
      data: mapOnboardingRow(result.rows[0])
    };
  }

  async applyAction(applicationId: string, payload: OnboardingReviewActionRequest) {
    const application = await this.getApplication(applicationId);

    if (!application) {
      return {
        error: "application_not_found" as const
      };
    }

    const nextState = this.resolveNextState(application.state, payload.action);

    if (!nextState) {
      return {
        error: "invalid_transition" as const,
        currentState: application.state
      };
    }

    const updatedApplication: OnboardingApplication = {
      ...application,
      state: nextState,
      reviewComment: payload.comment ?? application.reviewComment
    };

    if (payload.action === "approve") {
      if (application.onboardingMode === "new_corporate_tenant") {
        await this.tenantManagementService.createCorporateTenant(
          {
            tenantId: application.corporateTenantId,
            bankTenantId: application.bankTenantId,
            name: application.corporateTenantName ?? application.legalEntityName,
            legalEntityName:
              application.corporateTenantName ?? application.legalEntityName,
            corporateAdminEmail: application.primaryCorporateAdminEmail
          },
          "active"
        );
      }

      const generatedCorporateId = this.generateCorporateId(application.legalEntityName);
      await this.tenantManagementService.createCorporate(
        {
          corporateId: generatedCorporateId,
          corporateTenantId: application.corporateTenantId,
          bankTenantId: application.bankTenantId,
          name: application.legalEntityName,
          legalEntityName: application.legalEntityName,
          corporateAdminEmail: application.primaryCorporateAdminEmail
        },
        "active"
      );
    }

    const result = await this.db.query(
      `update onboarding_applications
       set state = $2,
           review_comment = $3
       where application_id = $1
       returning application_id, onboarding_mode, bank_tenant_id, corporate_tenant_id, corporate_tenant_name, legal_entity_name, signatory_name, gstin, pan, cin,
                 registered_address, primary_corporate_admin_email, state, review_comment`,
      [applicationId, updatedApplication.state, updatedApplication.reviewComment]
    );

    return {
      data: mapOnboardingRow(result.rows[0])
    };
  }

  private resolveNextState(
    currentState: OnboardingApplication["state"],
    action: OnboardingReviewActionRequest["action"]
  ): OnboardingApplication["state"] | null {
    if (action === "approve" && currentState === "submitted") {
      return "approved";
    }

    if (action === "reject" && currentState === "submitted") {
      return "rejected";
    }

    if (action === "send_back" && currentState === "submitted") {
      return "sent_back";
    }

    if (action === "submit" && currentState === "sent_back") {
      return "submitted";
    }

    return null;
  }

  private generateApplicationId(bankTenantId: string) {
    const prefix = bankTenantId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `${prefix}-APP-${Date.now()}`;
  }

  private generateCorporateTenantId(legalEntityName: string) {
    const slug = legalEntityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);

    return `corp-${slug}-${Date.now().toString().slice(-6)}`;
  }

  private generateCorporateId(legalEntityName: string) {
    const slug = legalEntityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);

    return `co-${slug}-${Date.now().toString().slice(-6)}`;
  }
}

function mapOnboardingRow(row: Record<string, string | null>) {
  return {
    applicationId: row.application_id as string,
    onboardingMode: row.onboarding_mode as OnboardingApplication["onboardingMode"],
    bankTenantId: row.bank_tenant_id as string,
    corporateTenantId: row.corporate_tenant_id as string,
    corporateTenantName: (row.corporate_tenant_name as string | null) ?? undefined,
    legalEntityName: row.legal_entity_name as string,
    signatoryName: row.signatory_name as string,
    gstin: (row.gstin as string | null) ?? undefined,
    pan: row.pan as string,
    registeredAddress: row.registered_address as string,
    primaryCorporateAdminEmail: row.primary_corporate_admin_email as string,
    state: row.state as OnboardingApplication["state"],
    reviewComment: row.review_comment
  } satisfies OnboardingApplication;
}
