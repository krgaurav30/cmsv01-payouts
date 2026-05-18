import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import type {
  BankTenant,
  BankTenantCreateRequest,
  Corporate,
  CorporateCreateRequest,
  CorporateTenant,
  CorporateTenantCreateRequest
} from "./contracts.js";

type BankTenantRow = {
  tenant_id: string;
  name: string;
  subdomain: string;
  primary_color: string;
  contact_email: string;
  status: BankTenant["status"];
};

type CorporateTenantRow = {
  tenant_id: string;
  bank_tenant_id: string;
  name: string;
  legal_entity_name: string;
  corporate_admin_email: string;
  status: CorporateTenant["status"];
};

type CorporateTenantStatus = CorporateTenant["status"];

type CorporateRow = {
  corporate_id: string;
  corporate_tenant_id: string;
  bank_tenant_id: string;
  name: string;
  legal_entity_name: string;
  corporate_admin_email: string;
  status: Corporate["status"];
};

export class TenantManagementService {
  private readonly db = getDatabasePool(loadConfig());

  async listBankTenants() {
    const result = await this.db.query<BankTenantRow>(
      `select tenant_id, name, subdomain, primary_color, contact_email, status
       from bank_tenants
       order by tenant_id`
    );

    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      name: row.name,
      subdomain: row.subdomain,
      primaryColor: row.primary_color,
      contactEmail: row.contact_email,
      status: row.status
    })) satisfies BankTenant[];
  }

  async getBankTenant(tenantId: string) {
    const result = await this.db.query<BankTenantRow>(
      `select tenant_id, name, subdomain, primary_color, contact_email, status
       from bank_tenants
       where tenant_id = $1`,
      [tenantId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      name: row.name,
      subdomain: row.subdomain,
      primaryColor: row.primary_color,
      contactEmail: row.contact_email,
      status: row.status
    } satisfies BankTenant;
  }

  async createBankTenant(payload: BankTenantCreateRequest) {
    const result = await this.db.query<BankTenantRow>(
      `insert into bank_tenants (tenant_id, name, subdomain, primary_color, contact_email, status)
       values ($1, $2, $3, $4, $5, 'active')
       on conflict (tenant_id) do update
       set name = excluded.name,
           subdomain = excluded.subdomain,
           primary_color = excluded.primary_color,
           contact_email = excluded.contact_email,
           status = excluded.status
       returning tenant_id, name, subdomain, primary_color, contact_email, status`,
      [
        payload.tenantId,
        payload.name,
        payload.subdomain,
        payload.primaryColor,
        payload.contactEmail
      ]
    );

    const row = result.rows[0];
    return {
      tenantId: row.tenant_id,
      name: row.name,
      subdomain: row.subdomain,
      primaryColor: row.primary_color,
      contactEmail: row.contact_email,
      status: row.status
    } satisfies BankTenant;
  }

  async listCorporateTenants(bankTenantId?: string, status?: CorporateTenantStatus) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (bankTenantId) {
      values.push(bankTenantId);
      clauses.push(`bank_tenant_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      clauses.push(`status = $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query<CorporateTenantRow>(
      `select tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
       from corporate_tenants
       ${whereClause}
       order by tenant_id`,
      values
    );

    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      bankTenantId: row.bank_tenant_id,
      name: row.name,
      legalEntityName: row.legal_entity_name,
      corporateAdminEmail: row.corporate_admin_email,
      status: row.status
    })) satisfies CorporateTenant[];
  }

  async getCorporateTenant(tenantId: string) {
    const result = await this.db.query<CorporateTenantRow>(
      `select tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
       from corporate_tenants
       where tenant_id = $1`,
      [tenantId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      bankTenantId: row.bank_tenant_id,
      name: row.name,
      legalEntityName: row.legal_entity_name,
      corporateAdminEmail: row.corporate_admin_email,
      status: row.status
    } satisfies CorporateTenant;
  }

  async listCorporates(corporateTenantId?: string, status?: Corporate["status"]) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (corporateTenantId) {
      values.push(corporateTenantId);
      clauses.push(`corporate_tenant_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      clauses.push(`status = $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query<CorporateRow>(
      `select corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
              corporate_admin_email, status
       from corporates
       ${whereClause}
       order by corporate_id`,
      values
    );

    return result.rows.map((row) => ({
      corporateId: row.corporate_id,
      corporateTenantId: row.corporate_tenant_id,
      bankTenantId: row.bank_tenant_id,
      name: row.name,
      legalEntityName: row.legal_entity_name,
      corporateAdminEmail: row.corporate_admin_email,
      status: row.status
    })) satisfies Corporate[];
  }

  async getCorporate(corporateId: string) {
    const result = await this.db.query<CorporateRow>(
      `select corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
              corporate_admin_email, status
       from corporates
       where corporate_id = $1`,
      [corporateId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      corporateId: row.corporate_id,
      corporateTenantId: row.corporate_tenant_id,
      bankTenantId: row.bank_tenant_id,
      name: row.name,
      legalEntityName: row.legal_entity_name,
      corporateAdminEmail: row.corporate_admin_email,
      status: row.status
    } satisfies Corporate;
  }

  async createCorporateTenant(
    payload: CorporateTenantCreateRequest,
    status: CorporateTenantStatus = "active"
  ) {
    const linkedBank = await this.getBankTenant(payload.bankTenantId);

    if (!linkedBank) {
      return {
        error: "bank_not_found" as const
      };
    }

    const result = await this.db.query<CorporateTenantRow>(
      `insert into corporate_tenants (
         tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
       )
       values ($1, $2, $3, $4, $5, $6)
       on conflict (tenant_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           name = excluded.name,
           legal_entity_name = excluded.legal_entity_name,
           corporate_admin_email = excluded.corporate_admin_email,
           status = excluded.status
       returning tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status`,
      [
        payload.tenantId,
        payload.bankTenantId,
        payload.name,
        payload.legalEntityName,
        payload.corporateAdminEmail,
        status
      ]
    );

    const row = result.rows[0];
    return {
      data: {
        tenantId: row.tenant_id,
        bankTenantId: row.bank_tenant_id,
        name: row.name,
        legalEntityName: row.legal_entity_name,
        corporateAdminEmail: row.corporate_admin_email,
        status: row.status
      } satisfies CorporateTenant
    };
  }

  async createCorporate(
    payload: CorporateCreateRequest,
    status: Corporate["status"] = "active"
  ) {
    const linkedBank = await this.getBankTenant(payload.bankTenantId);
    const linkedTenant = await this.getCorporateTenant(payload.corporateTenantId);

    if (!linkedBank) {
      return {
        error: "bank_not_found" as const
      };
    }

    if (!linkedTenant) {
      return {
        error: "corporate_tenant_not_found" as const
      };
    }

    const result = await this.db.query<CorporateRow>(
      `insert into corporates (
         corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
         corporate_admin_email, status
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (corporate_id) do update
       set corporate_tenant_id = excluded.corporate_tenant_id,
           bank_tenant_id = excluded.bank_tenant_id,
           name = excluded.name,
           legal_entity_name = excluded.legal_entity_name,
           corporate_admin_email = excluded.corporate_admin_email,
           status = excluded.status
       returning corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name,
                 corporate_admin_email, status`,
      [
        payload.corporateId,
        payload.corporateTenantId,
        payload.bankTenantId,
        payload.name,
        payload.legalEntityName,
        payload.corporateAdminEmail,
        status
      ]
    );

    const row = result.rows[0];
    return {
      data: {
        corporateId: row.corporate_id,
        corporateTenantId: row.corporate_tenant_id,
        bankTenantId: row.bank_tenant_id,
        name: row.name,
        legalEntityName: row.legal_entity_name,
        corporateAdminEmail: row.corporate_admin_email,
        status: row.status
      } satisfies Corporate
    };
  }
}
