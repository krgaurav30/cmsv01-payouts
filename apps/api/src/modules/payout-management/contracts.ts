import { z } from "zod";

export const payoutBatchStateSchema = z.enum([
  "draft",
  "pending_approval",
  "partially_approved",
  "approved",
  "rejected",
  "sent_to_bank",
  "paid",
  "failed"
]);

export const payoutItemStateSchema = z.enum([
  "pending",
  "sent_to_bank",
  "processed",
  "failed"
]);

export const moneySchema = z.object({
  value: z.number().positive(),
  currency: z.literal("INR").default("INR")
});

export const payoutItemSchema = z.object({
  itemId: z.string().min(3),
  beneficiaryId: z.string().min(3),
  amount: moneySchema,
  purpose: z.string().min(2)
});

export const payoutBatchCreateSchema = z.object({
  batchId: z.string().min(3),
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  createdByUserId: z.string().min(3),
  title: z.string().min(2),
  tag: z.string().min(1).optional(),
  remark: z.string().min(1).optional(),
  items: z.array(payoutItemSchema).min(1)
});

export const payoutBulkRowSchema = z.object({
  transactionReference: z.string().min(2),
  beneficiaryName: z.string().min(2),
  amount: z.number().positive(),
  tag: z.string().min(1).optional(),
  remark: z.string().min(1).optional()
});

export const payoutBulkCreateSchema = z.object({
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  createdByUserId: z.string().min(3),
  fileName: z.string().min(1),
  rows: z.array(payoutBulkRowSchema).min(1)
});

export const payoutFileUploadStatusSchema = z.enum([
  "processing",
  "successful",
  "partially_successful",
  "failed",
  "rejected"
]);

export const payoutFileUploadCreateSchema = z.object({
  uploadId: z.string().min(3),
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  fileName: z.string().min(1),
  uploadedByUserId: z.string().min(3),
  status: payoutFileUploadStatusSchema,
  remark: z.string().min(1).optional(),
  totalRows: z.number().int().nonnegative(),
  createdCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  payloadRows: z.array(payoutBulkRowSchema).optional()
});

export const publishedPayoutCreateSchema = z.object({
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  actorUsername: z.string().min(3),
  txnTitle: z.string().min(2),
  beneficiaryId: z.string().min(3),
  amount: moneySchema,
  tag: z.string().min(1).optional(),
  remark: z.string().min(1).optional()
});

export const payoutApprovalActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject"]),
  actedByUserId: z.string().min(3),
  comment: z.string().min(2).max(500).optional()
});

export const publishedPayoutApprovalSchema = z.object({
  actorUsername: z.string().min(3),
  action: z.enum(["approve", "reject"]),
  comment: z.string().min(2).max(500).optional()
});

export const payoutDispatchSchema = z.object({
  actedByUserId: z.string().min(3),
  comment: z.string().min(2).max(500).optional()
});

export const payoutSimulationSchema = z.object({
  actedByUserId: z.string().min(3),
  comment: z.string().min(2).max(500).optional()
});

export const payoutRefundStateSchema = z.enum([
  "requested",
  "under_review",
  "approved",
  "processed",
  "rejected"
]);

export const payoutRefundCreateSchema = z.object({
  refundId: z.string().min(3),
  batchId: z.string().min(3),
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3),
  requestedByUserId: z.string().min(3),
  amount: z.number().positive(),
  reason: z.string().min(5).max(500)
});

export type PayoutBatchState = z.infer<typeof payoutBatchStateSchema>;
export type PayoutItemState = z.infer<typeof payoutItemStateSchema>;
export type PayoutBatchCreateRequest = z.infer<typeof payoutBatchCreateSchema>;
export type PayoutBulkCreateRequest = z.infer<typeof payoutBulkCreateSchema>;
export type PayoutBulkRow = z.infer<typeof payoutBulkRowSchema>;
export type PayoutFileUploadStatus = z.infer<typeof payoutFileUploadStatusSchema>;
export type PayoutFileUploadCreateRequest = z.infer<typeof payoutFileUploadCreateSchema>;
export type PublishedPayoutCreateRequest = z.infer<typeof publishedPayoutCreateSchema>;
export type PayoutApprovalActionRequest = z.infer<
  typeof payoutApprovalActionSchema
>;
export type PublishedPayoutApprovalRequest = z.infer<
  typeof publishedPayoutApprovalSchema
>;
export type PayoutDispatchRequest = z.infer<typeof payoutDispatchSchema>;
export type PayoutSimulationRequest = z.infer<typeof payoutSimulationSchema>;
export type PayoutRefundState = z.infer<typeof payoutRefundStateSchema>;
export type PayoutRefundCreateRequest = z.infer<typeof payoutRefundCreateSchema>;
export type PayoutItemInput = z.infer<typeof payoutItemSchema>;
export type Money = z.infer<typeof moneySchema>;

export type PayoutTimelineEvent = {
  event: "created" | "submitted" | "approved" | "rejected";
  role: string | null;
  userId: string | null;
  userName: string | null;
  at: string | null;
};

export type PayoutBatch = {
  batchId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  primaryBeneficiaryId: string | null;
  primaryBeneficiaryName: string | null;
  createdByUserId: string;
  createdByRole: string | null;
  title: string;
  tag: string | null;
  remark: string | null;
  state: PayoutBatchState;
  totalAmount: Money;
  approvalComment: string | null;
  bankReference: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  approvalLevelsRequired: number | null;
  currentApprovalLevel: number | null;
  approvalRoles: string[];
  matchedApprovalMatrixIds: string[];
  createdAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  submittedByUserId: string | null;
  submittedByRole: string | null;
  approvedByUserId: string | null;
  approvedByRole: string | null;
  rejectedByUserId: string | null;
  rejectedByRole: string | null;
  timeline: PayoutTimelineEvent[];
  items: PayoutItem[];
};

export type PayoutItem = PayoutItemInput & {
  state: PayoutItemState;
  bankReference: string | null;
  failureReason: string | null;
  processedAt: string | null;
};

export type PayoutRefund = Omit<PayoutRefundCreateRequest, "corporateId"> & {
  corporateId: string | null;
  state: PayoutRefundState;
  createdAt: string | null;
  processedAt: string | null;
};

export type PayoutFileUpload = {
  uploadId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  fileName: string;
  uploadedByUserId: string;
  uploadedByRole: string | null;
  uploadedByName: string | null;
  status: PayoutFileUploadStatus;
  remark: string | null;
  totalRows: number;
  createdCount: number;
  rejectedCount: number;
  uploadedAt: string | null;
};
