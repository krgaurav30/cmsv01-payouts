import { z } from "zod";

export const debitAccountStatusSchema = z.enum(["active", "inactive"]);

export const debitAccountCreateSchema = z.object({
  actedByUserId: z.string().min(1),
  bankTenantId: z.string().min(1),
  corporateTenantId: z.string().min(1),
  corporateId: z.string().min(1),
  accountName: z.string().trim().min(2),
  accountNumber: z.string().trim().min(6).max(30),
  ifsc: z.string().trim().min(5).max(20),
  isDefault: z.boolean().default(false),
  initialBalance: z.number().or(z.string()).optional().transform(v => v !== undefined ? Number(v) : undefined)
});

export const debitAccountUpdateSchema = z.object({
  actedByUserId: z.string().min(1),
  accountName: z.string().trim().min(2),
  accountNumber: z.string().trim().min(6).max(30),
  ifsc: z.string().trim().min(5).max(20),
  isDefault: z.boolean().default(false),
  status: debitAccountStatusSchema
});

export const subscriptionDebitAccountAccessUpdateSchema = z.object({
  actedByUserId: z.string().min(1),
  debitAccountIds: z.array(z.string().min(1)).min(1),
  defaultDebitAccountId: z.string().min(1)
});

export type CorporateDebitAccount = {
  debitAccountId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  isDefault: boolean;
  status: z.infer<typeof debitAccountStatusSchema>;
  balance: string;
  createdAt: number | null;
  updatedAt: number | null;
};

export type DebitAccountCreateRequest = z.infer<typeof debitAccountCreateSchema>;
export type DebitAccountUpdateRequest = z.infer<typeof debitAccountUpdateSchema>;
export type SubscriptionDebitAccountAccessUpdateRequest = z.infer<
  typeof subscriptionDebitAccountAccessUpdateSchema
>;
