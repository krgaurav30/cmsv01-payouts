import { z } from "zod";
export declare const bankTenantCreateSchema: z.ZodObject<{
    tenantId: z.ZodString;
    name: z.ZodString;
    subdomain: z.ZodString;
    primaryColor: z.ZodString;
    contactEmail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    tenantId: string;
    subdomain: string;
    primaryColor: string;
    contactEmail: string;
}, {
    name: string;
    tenantId: string;
    subdomain: string;
    primaryColor: string;
    contactEmail: string;
}>;
export declare const corporateTenantCreateSchema: z.ZodObject<{
    tenantId: z.ZodString;
    bankTenantId: z.ZodString;
    name: z.ZodString;
    legalEntityName: z.ZodString;
    corporateAdminEmail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bankTenantId: string;
    name: string;
    legalEntityName: string;
    corporateAdminEmail: string;
    tenantId: string;
}, {
    bankTenantId: string;
    name: string;
    legalEntityName: string;
    corporateAdminEmail: string;
    tenantId: string;
}>;
export declare const corporateCreateSchema: z.ZodObject<{
    corporateId: z.ZodString;
    corporateTenantId: z.ZodString;
    bankTenantId: z.ZodString;
    name: z.ZodString;
    legalEntityName: z.ZodString;
    corporateAdminEmail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    name: string;
    legalEntityName: string;
    corporateAdminEmail: string;
}, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    name: string;
    legalEntityName: string;
    corporateAdminEmail: string;
}>;
export type BankTenantCreateRequest = z.infer<typeof bankTenantCreateSchema>;
export type CorporateTenantCreateRequest = z.infer<typeof corporateTenantCreateSchema>;
export type CorporateCreateRequest = z.infer<typeof corporateCreateSchema>;
export type BankTenant = BankTenantCreateRequest & {
    status: "draft" | "active";
};
export type CorporateTenant = CorporateTenantCreateRequest & {
    status: "draft" | "onboarding" | "active";
};
export type Corporate = CorporateCreateRequest & {
    status: "draft" | "onboarding" | "active";
};
