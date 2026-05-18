import { z } from "zod";
export declare const payoutBatchStateSchema: z.ZodEnum<["draft", "pending_approval", "partially_approved", "approved", "rejected", "sent_to_bank", "paid", "failed"]>;
export declare const payoutItemStateSchema: z.ZodEnum<["pending", "sent_to_bank", "processed", "failed"]>;
export declare const moneySchema: z.ZodObject<{
    value: z.ZodNumber;
    currency: z.ZodDefault<z.ZodLiteral<"INR">>;
}, "strip", z.ZodTypeAny, {
    value: number;
    currency: "INR";
}, {
    value: number;
    currency?: "INR" | undefined;
}>;
export declare const payoutItemSchema: z.ZodObject<{
    itemId: z.ZodString;
    beneficiaryId: z.ZodString;
    amount: z.ZodObject<{
        value: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"INR">>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        currency: "INR";
    }, {
        value: number;
        currency?: "INR" | undefined;
    }>;
    purpose: z.ZodString;
}, "strip", z.ZodTypeAny, {
    itemId: string;
    beneficiaryId: string;
    amount: {
        value: number;
        currency: "INR";
    };
    purpose: string;
}, {
    itemId: string;
    beneficiaryId: string;
    amount: {
        value: number;
        currency?: "INR" | undefined;
    };
    purpose: string;
}>;
export declare const payoutBatchCreateSchema: z.ZodObject<{
    batchId: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    createdByUserId: z.ZodString;
    title: z.ZodString;
    tag: z.ZodOptional<z.ZodString>;
    remark: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        beneficiaryId: z.ZodString;
        amount: z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodLiteral<"INR">>;
        }, "strip", z.ZodTypeAny, {
            value: number;
            currency: "INR";
        }, {
            value: number;
            currency?: "INR" | undefined;
        }>;
        purpose: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        beneficiaryId: string;
        amount: {
            value: number;
            currency: "INR";
        };
        purpose: string;
    }, {
        itemId: string;
        beneficiaryId: string;
        amount: {
            value: number;
            currency?: "INR" | undefined;
        };
        purpose: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    batchId: string;
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    items: {
        itemId: string;
        beneficiaryId: string;
        amount: {
            value: number;
            currency: "INR";
        };
        purpose: string;
    }[];
    tag?: string | undefined;
    remark?: string | undefined;
}, {
    title: string;
    batchId: string;
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    items: {
        itemId: string;
        beneficiaryId: string;
        amount: {
            value: number;
            currency?: "INR" | undefined;
        };
        purpose: string;
    }[];
    tag?: string | undefined;
    remark?: string | undefined;
}>;
export declare const payoutBulkRowSchema: z.ZodObject<{
    transactionReference: z.ZodString;
    beneficiaryName: z.ZodString;
    amount: z.ZodNumber;
    tag: z.ZodOptional<z.ZodString>;
    remark: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    transactionReference: string;
    beneficiaryName: string;
    tag?: string | undefined;
    remark?: string | undefined;
}, {
    amount: number;
    transactionReference: string;
    beneficiaryName: string;
    tag?: string | undefined;
    remark?: string | undefined;
}>;
export declare const payoutBulkCreateSchema: z.ZodObject<{
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    createdByUserId: z.ZodString;
    fileName: z.ZodString;
    rows: z.ZodArray<z.ZodObject<{
        transactionReference: z.ZodString;
        beneficiaryName: z.ZodString;
        amount: z.ZodNumber;
        tag: z.ZodOptional<z.ZodString>;
        remark: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }, {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    fileName: string;
    rows: {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }[];
}, {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    createdByUserId: string;
    fileName: string;
    rows: {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }[];
}>;
export declare const payoutFileUploadStatusSchema: z.ZodEnum<["processing", "successful", "partially_successful", "failed", "rejected"]>;
export declare const payoutFileUploadCreateSchema: z.ZodObject<{
    uploadId: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    fileName: z.ZodString;
    uploadedByUserId: z.ZodString;
    status: z.ZodEnum<["processing", "successful", "partially_successful", "failed", "rejected"]>;
    remark: z.ZodOptional<z.ZodString>;
    totalRows: z.ZodNumber;
    createdCount: z.ZodNumber;
    rejectedCount: z.ZodNumber;
    payloadRows: z.ZodOptional<z.ZodArray<z.ZodObject<{
        transactionReference: z.ZodString;
        beneficiaryName: z.ZodString;
        amount: z.ZodNumber;
        tag: z.ZodOptional<z.ZodString>;
        remark: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }, {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    fileName: string;
    uploadId: string;
    uploadedByUserId: string;
    totalRows: number;
    createdCount: number;
    rejectedCount: number;
    remark?: string | undefined;
    payloadRows?: {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }[] | undefined;
}, {
    status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    fileName: string;
    uploadId: string;
    uploadedByUserId: string;
    totalRows: number;
    createdCount: number;
    rejectedCount: number;
    remark?: string | undefined;
    payloadRows?: {
        amount: number;
        transactionReference: string;
        beneficiaryName: string;
        tag?: string | undefined;
        remark?: string | undefined;
    }[] | undefined;
}>;
export declare const publishedPayoutCreateSchema: z.ZodObject<{
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    actorUsername: z.ZodString;
    txnTitle: z.ZodString;
    beneficiaryId: z.ZodString;
    amount: z.ZodObject<{
        value: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"INR">>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        currency: "INR";
    }, {
        value: number;
        currency?: "INR" | undefined;
    }>;
    tag: z.ZodOptional<z.ZodString>;
    remark: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    beneficiaryId: string;
    amount: {
        value: number;
        currency: "INR";
    };
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    actorUsername: string;
    txnTitle: string;
    tag?: string | undefined;
    remark?: string | undefined;
}, {
    beneficiaryId: string;
    amount: {
        value: number;
        currency?: "INR" | undefined;
    };
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    actorUsername: string;
    txnTitle: string;
    tag?: string | undefined;
    remark?: string | undefined;
}>;
export declare const payoutApprovalActionSchema: z.ZodObject<{
    action: z.ZodEnum<["submit", "approve", "reject"]>;
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "submit" | "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}, {
    action: "submit" | "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}>;
export declare const publishedPayoutApprovalSchema: z.ZodObject<{
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
export declare const payoutDispatchSchema: z.ZodObject<{
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actedByUserId: string;
    comment?: string | undefined;
}, {
    actedByUserId: string;
    comment?: string | undefined;
}>;
export declare const payoutSimulationSchema: z.ZodObject<{
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actedByUserId: string;
    comment?: string | undefined;
}, {
    actedByUserId: string;
    comment?: string | undefined;
}>;
export declare const payoutRefundStateSchema: z.ZodEnum<["requested", "under_review", "approved", "processed", "rejected"]>;
export declare const payoutRefundCreateSchema: z.ZodObject<{
    refundId: z.ZodString;
    batchId: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodString;
    requestedByUserId: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    batchId: string;
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    refundId: string;
    requestedByUserId: string;
    reason: string;
}, {
    amount: number;
    batchId: string;
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    refundId: string;
    requestedByUserId: string;
    reason: string;
}>;
export type PayoutBatchState = z.infer<typeof payoutBatchStateSchema>;
export type PayoutItemState = z.infer<typeof payoutItemStateSchema>;
export type PayoutBatchCreateRequest = z.infer<typeof payoutBatchCreateSchema>;
export type PayoutBulkCreateRequest = z.infer<typeof payoutBulkCreateSchema>;
export type PayoutBulkRow = z.infer<typeof payoutBulkRowSchema>;
export type PayoutFileUploadStatus = z.infer<typeof payoutFileUploadStatusSchema>;
export type PayoutFileUploadCreateRequest = z.infer<typeof payoutFileUploadCreateSchema>;
export type PublishedPayoutCreateRequest = z.infer<typeof publishedPayoutCreateSchema>;
export type PayoutApprovalActionRequest = z.infer<typeof payoutApprovalActionSchema>;
export type PublishedPayoutApprovalRequest = z.infer<typeof publishedPayoutApprovalSchema>;
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
