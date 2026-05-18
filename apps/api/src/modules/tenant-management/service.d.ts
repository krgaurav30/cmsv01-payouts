import type { BankTenantCreateRequest, Corporate, CorporateCreateRequest, CorporateTenant, CorporateTenantCreateRequest } from "./contracts.js";
type CorporateTenantStatus = CorporateTenant["status"];
export declare class TenantManagementService {
    private readonly db;
    listBankTenants(): Promise<{
        tenantId: string;
        name: string;
        subdomain: string;
        primaryColor: string;
        contactEmail: string;
        status: "draft" | "active";
    }[]>;
    getBankTenant(tenantId: string): Promise<{
        tenantId: string;
        name: string;
        subdomain: string;
        primaryColor: string;
        contactEmail: string;
        status: "draft" | "active";
    } | null>;
    createBankTenant(payload: BankTenantCreateRequest): Promise<{
        tenantId: string;
        name: string;
        subdomain: string;
        primaryColor: string;
        contactEmail: string;
        status: "draft" | "active";
    }>;
    listCorporateTenants(bankTenantId?: string, status?: CorporateTenantStatus): Promise<{
        tenantId: string;
        bankTenantId: string;
        name: string;
        legalEntityName: string;
        corporateAdminEmail: string;
        status: "draft" | "active" | "onboarding";
    }[]>;
    getCorporateTenant(tenantId: string): Promise<{
        tenantId: string;
        bankTenantId: string;
        name: string;
        legalEntityName: string;
        corporateAdminEmail: string;
        status: "draft" | "active" | "onboarding";
    } | null>;
    listCorporates(corporateTenantId?: string, status?: Corporate["status"]): Promise<{
        corporateId: string;
        corporateTenantId: string;
        bankTenantId: string;
        name: string;
        legalEntityName: string;
        corporateAdminEmail: string;
        status: "draft" | "active" | "onboarding";
    }[]>;
    getCorporate(corporateId: string): Promise<{
        corporateId: string;
        corporateTenantId: string;
        bankTenantId: string;
        name: string;
        legalEntityName: string;
        corporateAdminEmail: string;
        status: "draft" | "active" | "onboarding";
    } | null>;
    createCorporateTenant(payload: CorporateTenantCreateRequest, status?: CorporateTenantStatus): Promise<{
        error: "bank_not_found";
        data?: undefined;
    } | {
        data: {
            tenantId: string;
            bankTenantId: string;
            name: string;
            legalEntityName: string;
            corporateAdminEmail: string;
            status: "draft" | "active" | "onboarding";
        };
        error?: undefined;
    }>;
    createCorporate(payload: CorporateCreateRequest, status?: Corporate["status"]): Promise<{
        error: "bank_not_found";
        data?: undefined;
    } | {
        error: "corporate_tenant_not_found";
        data?: undefined;
    } | {
        data: {
            corporateId: string;
            corporateTenantId: string;
            bankTenantId: string;
            name: string;
            legalEntityName: string;
            corporateAdminEmail: string;
            status: "draft" | "active" | "onboarding";
        };
        error?: undefined;
    }>;
}
export {};
