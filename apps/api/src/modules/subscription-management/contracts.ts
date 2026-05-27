import { z } from "zod";

export const subscriptionStatusSchema = z.enum([
  "draft",
  "active",
  "suspended",
  "terminated"
]);

export type SubscriptionDebitAccountAccess = {
  debitAccountId: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  allowedPaymentMethodCodes: string[];
  isDefault: boolean;
  status: "active" | "inactive";
};

export type SubscriptionUserAccess = {
  accessId: string;
  userId: string;
  username: string;
  displayName: string;
  roleName: string;
  status: "active" | "inactive";
};

export const subscriptionCreateSchema = z.object({
  bankTenantId: z.string().min(1),
  corporateTenantId: z.string().min(1),
  corporateId: z.string().min(1),
  packageId: z.string().min(1),
  createdByUserId: z.string().min(1),
  createdByRole: z.string().min(1).optional()
});

export const subscriptionStatusUpdateSchema = z.object({
  status: subscriptionStatusSchema,
  actedByUserId: z.string().min(1),
  actedByRole: z.string().min(1).optional()
});

export const subscriptionRoleAccessUpdateSchema = z.object({
  actedByUserId: z.string().min(1),
  corporateTenantId: z.string().min(1),
  corporateId: z.string().min(1),
  roleName: z.string().min(2).max(80),
  subscriptionIds: z.array(z.string().min(1))
});

export type CorporateSubscription = {
  subscriptionId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  packageId: string;
  packageCode: string;
  displayName: string;
  status: z.infer<typeof subscriptionStatusSchema>;
  startedAt: number | null;
  suspendedAt: number | null;
  terminatedAt: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  debitAccounts: SubscriptionDebitAccountAccess[];
  userAccess: SubscriptionUserAccess[];
};

export type SubscriptionCreateRequest = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionStatusUpdateRequest = z.infer<typeof subscriptionStatusUpdateSchema>;
export type SubscriptionRoleAccessUpdateRequest = z.infer<
  typeof subscriptionRoleAccessUpdateSchema
>;
