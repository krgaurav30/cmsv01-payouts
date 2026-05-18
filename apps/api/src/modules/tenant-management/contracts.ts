import { z } from "zod";

export const bankTenantCreateSchema = z.object({
  tenantId: z.string().min(3),
  name: z.string().min(2),
  subdomain: z.string().min(2),
  primaryColor: z.string().min(3).max(32),
  contactEmail: z.string().email()
});

export const corporateTenantCreateSchema = z.object({
  tenantId: z.string().min(3),
  bankTenantId: z.string().min(3),
  name: z.string().min(2),
  legalEntityName: z.string().min(2),
  corporateAdminEmail: z.string().email()
});

export const corporateCreateSchema = z.object({
  corporateId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  bankTenantId: z.string().min(3),
  name: z.string().min(2),
  legalEntityName: z.string().min(2),
  corporateAdminEmail: z.string().email()
});

export type BankTenantCreateRequest = z.infer<typeof bankTenantCreateSchema>;
export type CorporateTenantCreateRequest = z.infer<
  typeof corporateTenantCreateSchema
>;
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
