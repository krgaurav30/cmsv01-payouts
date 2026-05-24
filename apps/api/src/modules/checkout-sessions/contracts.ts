import { z } from "zod";

export const checkoutSessionCreateSchema = z.object({
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  transactionReference: z.string().min(2),
  amount: z.object({
    value: z.number().positive(),
    currency: z.string().min(2)
  }),
  packageCode: z.string().min(2).optional(),
  beneficiaryId: z.string().min(3),
  paymentMethodCode: z.string().min(2).optional(),
  redirectUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

export type CheckoutSessionCreateRequest = z.infer<typeof checkoutSessionCreateSchema>;

export type CheckoutSession = {
  checkoutSessionId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  transactionReference: string;
  amountValue: string;
  amountCurrency: string;
  packageCode: string | null;
  beneficiaryId: string;
  paymentMethodCode: string | null;
  redirectUrl: string | null;
  cancelUrl: string | null;
  status: "open" | "completed" | "expired";
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  metadataJson: Record<string, any>;
};
