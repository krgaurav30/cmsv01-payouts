import { z } from "zod";

export const beneficiaryApprovalStateSchema = z.enum([
  "pending_approval",
  "approved",
  "rejected"
]);

export const beneficiaryStatusSchema = z.enum(["active", "inactive"]);
export const beneficiaryTypeSchema = z.enum(["vendor", "employee", "statutory"]);

export const beneficiaryCreateSchema = z.object({
  createdByUserId: z.string().min(3),
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  beneficiaryId: z.string().min(3).max(40),
  name: z.string().min(2),
  accountNumber: z.string().min(6),
  ifsc: z.string().min(5),
  phoneNumber: z.string().min(10),
  beneficiaryType: beneficiaryTypeSchema.default("vendor"),
  packageCodes: z.array(z.string().min(2)).min(1),
  tags: z.array(z.string().min(1)).default([])
});

export const publishedBeneficiaryCreateSchema = z.object({
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  actorUsername: z.string().min(3),
  beneId: z.string().min(3).max(40),
  beneName: z.string().min(2),
  beneBankAccountNumber: z.string().min(6),
  beneIfscCode: z.string().min(5),
  benePhoneNumber: z.string().min(10),
  beneType: beneficiaryTypeSchema.default("vendor"),
  benePackageCodes: z.array(z.string().min(2)).min(1),
  tags: z.array(z.string().min(1)).default([])
});

export const publishedBeneficiaryApprovalSchema = z.object({
  actorUsername: z.string().min(3),
  action: z.enum(["approve", "reject"]),
  comment: z.string().min(2).max(500).optional()
});

export const beneficiaryUpdateSchema = beneficiaryCreateSchema
  .omit({
    createdByUserId: true,
    bankTenantId: true,
    corporateTenantId: true,
    corporateId: true,
    beneficiaryId: true
  })
  .extend({
    actedByUserId: z.string().min(3)
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

export type BeneficiaryApprovalState = z.infer<typeof beneficiaryApprovalStateSchema>;
export type BeneficiaryStatus = z.infer<typeof beneficiaryStatusSchema>;
export type BeneficiaryType = z.infer<typeof beneficiaryTypeSchema>;
export type BeneficiaryCreateRequest = z.infer<typeof beneficiaryCreateSchema>;
export type PublishedBeneficiaryCreateRequest = z.infer<
  typeof publishedBeneficiaryCreateSchema
>;
export type PublishedBeneficiaryApprovalRequest = z.infer<
  typeof publishedBeneficiaryApprovalSchema
>;
export type BeneficiaryUpdateRequest = z.infer<typeof beneficiaryUpdateSchema>;
export type BeneficiaryApprovalActionRequest = z.infer<
  typeof beneficiaryApprovalActionSchema
>;
export type BeneficiaryStatusActionRequest = z.infer<
  typeof beneficiaryStatusActionSchema
>;

export type BeneficiaryPackageAssignment = {
  packageId: string;
  packageCode: string;
  displayName: string;
  ownerType: "bank" | "corporate";
};

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
  beneficiaryType: BeneficiaryType;
  assignedPackages: BeneficiaryPackageAssignment[];
  tags: string[];
  status: BeneficiaryStatus;
  approvalState: BeneficiaryApprovalState;
  reviewComment: string | null;
  lastUpdatedAt: number | null;
};
