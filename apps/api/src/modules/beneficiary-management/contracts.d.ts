import { z } from "zod";
export declare const beneficiaryApprovalStateSchema: z.ZodEnum<["pending_approval", "approved", "rejected"]>;
export declare const beneficiaryStatusSchema: z.ZodEnum<["active", "inactive"]>;
export declare const beneficiaryCreateSchema: z.ZodObject<{
    createdByUserId: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    name: z.ZodString;
    accountNumber: z.ZodString;
    ifsc: z.ZodString;
    phoneNumber: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    name: string;
    accountNumber: string;
    ifsc: string;
    phoneNumber: string;
    tags: string[];
    category?: string | undefined;
}, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    name: string;
    accountNumber: string;
    ifsc: string;
    phoneNumber: string;
    category?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const publishedBeneficiaryCreateSchema: z.ZodObject<{
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    actorUsername: z.ZodString;
    beneName: z.ZodString;
    beneBankAccountNumber: z.ZodString;
    beneIfscCode: z.ZodString;
    benePhoneNumber: z.ZodString;
    beneCategory: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    actorUsername: string;
    tags: string[];
    beneName: string;
    beneBankAccountNumber: string;
    beneIfscCode: string;
    benePhoneNumber: string;
    beneCategory?: string | undefined;
}, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    actorUsername: string;
    beneName: string;
    beneBankAccountNumber: string;
    beneIfscCode: string;
    benePhoneNumber: string;
    tags?: string[] | undefined;
    beneCategory?: string | undefined;
}>;
export declare const publishedBeneficiaryApprovalSchema: z.ZodObject<{
    actorUsername: z.ZodString;
    action: z.ZodEnum<["approve", "reject"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    actorUsername: string;
    comment?: string | undefined;
}, {
    action: "approve" | "reject";
    actorUsername: string;
    comment?: string | undefined;
}>;
export declare const beneficiaryUpdateSchema: z.ZodObject<Omit<{
    createdByUserId: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    name: z.ZodString;
    accountNumber: z.ZodString;
    ifsc: z.ZodString;
    phoneNumber: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "bankTenantId" | "corporateTenantId" | "corporateId" | "createdByUserId">, "strip", z.ZodTypeAny, {
    name: string;
    accountNumber: string;
    ifsc: string;
    phoneNumber: string;
    tags: string[];
    category?: string | undefined;
}, {
    name: string;
    accountNumber: string;
    ifsc: string;
    phoneNumber: string;
    category?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const beneficiaryApprovalActionSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}, {
    action: "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}>;
export declare const beneficiaryStatusActionSchema: z.ZodObject<{
    action: z.ZodEnum<["activate", "deactivate"]>;
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "activate" | "deactivate";
    actedByUserId: string;
    comment?: string | undefined;
}, {
    action: "activate" | "deactivate";
    actedByUserId: string;
    comment?: string | undefined;
}>;
export type BeneficiaryApprovalState = z.infer<typeof beneficiaryApprovalStateSchema>;
export type BeneficiaryStatus = z.infer<typeof beneficiaryStatusSchema>;
export type BeneficiaryCreateRequest = z.infer<typeof beneficiaryCreateSchema>;
export type PublishedBeneficiaryCreateRequest = z.infer<typeof publishedBeneficiaryCreateSchema>;
export type PublishedBeneficiaryApprovalRequest = z.infer<typeof publishedBeneficiaryApprovalSchema>;
export type BeneficiaryUpdateRequest = z.infer<typeof beneficiaryUpdateSchema>;
export type BeneficiaryApprovalActionRequest = z.infer<typeof beneficiaryApprovalActionSchema>;
export type BeneficiaryStatusActionRequest = z.infer<typeof beneficiaryStatusActionSchema>;
export type Beneficiary = {
    beneficiaryId: string;
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string | null;
    name: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    phoneNumber: string | null;
    category: string | null;
    tags: string[];
    status: BeneficiaryStatus;
    approvalState: BeneficiaryApprovalState;
    reviewComment: string | null;
    lastUpdatedAt: string | null;
};
