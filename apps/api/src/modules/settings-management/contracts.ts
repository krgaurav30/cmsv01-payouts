import { z } from "zod";

export const duplicateReferencePolicySchema = z.enum(["enabled", "disabled"]);

export const corporateTenantSettingsSchema = z.object({
  corporateTenantId: z.string().min(3),
  actedByUserId: z.string().min(3),
  companyDisplayName: z.string().min(2).max(120),
  supportEmail: z.string().email().optional().or(z.literal("")),
  supportPhone: z.string().min(6).max(30).optional().or(z.literal("")),
  registeredAddress: z.string().min(5).max(500).optional().or(z.literal("")),
  defaultApprovalNoteTemplate: z.string().min(2).max(500).optional().or(z.literal("")),
  maxSingleTransactionAmount: z.number().int().positive(),
  maxDailyCumulativeTransactionAmount: z.number().int().positive(),
  maxBulkUploadRows: z.number().int().positive().max(5000),
  duplicateReferencePolicy: duplicateReferencePolicySchema
});

export type DuplicateReferencePolicy = z.infer<typeof duplicateReferencePolicySchema>;
export type CorporateTenantSettingsRequest = z.infer<typeof corporateTenantSettingsSchema>;

export type CorporateTenantSettings = {
  corporateTenantId: string;
  companyDisplayName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  registeredAddress: string | null;
  defaultApprovalNoteTemplate: string | null;
  maxSingleTransactionAmount: number;
  maxDailyCumulativeTransactionAmount: number;
  maxBulkUploadRows: number;
  duplicateReferencePolicy: DuplicateReferencePolicy;
  updatedAt: number | null;
  updatedByUserId: string | null;
  updatedByRole: string | null;
};
