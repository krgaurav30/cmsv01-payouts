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
