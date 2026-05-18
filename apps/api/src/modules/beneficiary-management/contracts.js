import { z } from "zod";
export const beneficiaryApprovalStateSchema = z.enum([
    "pending_approval",
    "approved",
    "rejected"
]);
export const beneficiaryStatusSchema = z.enum(["active", "inactive"]);
export const beneficiaryCreateSchema = z.object({
    createdByUserId: z.string().min(3),
    bankTenantId: z.string().min(3),
    corporateTenantId: z.string().min(3),
    corporateId: z.string().min(3),
    name: z.string().min(2),
    accountNumber: z.string().min(6),
    ifsc: z.string().min(5),
    phoneNumber: z.string().min(10),
    category: z.string().min(2).optional(),
    tags: z.array(z.string().min(1)).default([])
});
export const publishedBeneficiaryCreateSchema = z.object({
    bankTenantId: z.string().min(3),
    corporateTenantId: z.string().min(3),
    corporateId: z.string().min(3),
    actorUsername: z.string().min(3),
    beneName: z.string().min(2),
    beneBankAccountNumber: z.string().min(6),
    beneIfscCode: z.string().min(5),
    benePhoneNumber: z.string().min(10),
    beneCategory: z.string().min(2).optional(),
    tags: z.array(z.string().min(1)).default([])
});
export const publishedBeneficiaryApprovalSchema = z.object({
    actorUsername: z.string().min(3),
    action: z.enum(["approve", "reject"]),
    comment: z.string().min(2).max(500).optional()
});
export const beneficiaryUpdateSchema = beneficiaryCreateSchema.omit({
    createdByUserId: true,
    bankTenantId: true,
    corporateTenantId: true,
    corporateId: true
});
export const beneficiaryApprovalActionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    actedByUserId: z.string().min(3),
    comment: z.string().min(2).max(500).optional()
});
export const beneficiaryStatusActionSchema = z.object({
    action: z.enum(["activate", "deactivate"]),
    actedByUserId: z.string().min(3),
    comment: z.string().min(2).max(500).optional()
});
