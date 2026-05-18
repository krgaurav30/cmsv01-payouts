import { z } from "zod";

export const onboardingStateSchema = z.enum([
  "submitted",
  "sent_back",
  "approved",
  "rejected"
]);

export const onboardingModeSchema = z.enum([
  "new_corporate_tenant",
  "new_corporate_under_existing_tenant"
]);

export const onboardingApplicationCreateSchema = z
  .object({
    onboardingMode: onboardingModeSchema,
    bankTenantId: z.string().min(3),
    corporateTenantId: z.string().min(3).optional(),
    corporateTenantName: z.string().min(2).optional(),
    legalEntityName: z.string().min(2),
    signatoryName: z.string().min(2),
    gstin: z.string().min(5).optional(),
    pan: z.string().min(5),
    registeredAddress: z.string().min(10),
    primaryCorporateAdminEmail: z.string().email()
  })
  .superRefine((value, ctx) => {
    if (
      value.onboardingMode === "new_corporate_under_existing_tenant" &&
      (!value.corporateTenantId || value.corporateTenantId.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["corporateTenantId"],
        message: "Corporate tenant is required for existing corporate onboarding"
      });
    }

    if (
      value.onboardingMode === "new_corporate_tenant" &&
      (!value.corporateTenantName || value.corporateTenantName.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["corporateTenantName"],
        message: "Corporate tenant name is required for new corporate tenant onboarding"
      });
    }
  });

export const onboardingReviewActionSchema = z.object({
  action: z.enum(["submit", "send_back", "approve", "reject"]),
  comment: z.string().min(2).max(500).optional()
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export type OnboardingMode = z.infer<typeof onboardingModeSchema>;
export type OnboardingApplicationCreateRequest = z.infer<
  typeof onboardingApplicationCreateSchema
>;
export type OnboardingReviewActionRequest = z.infer<
  typeof onboardingReviewActionSchema
>;

export type OnboardingApplication = OnboardingApplicationCreateRequest & {
  applicationId: string;
  corporateTenantId: string;
  state: OnboardingState;
  reviewComment: string | null;
};
