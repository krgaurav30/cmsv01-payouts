import { type DatabaseExecutor } from "@cmsv01/shared/db";
import { ApprovalMatrixManagementService } from "../approval-matrix-management/service.js";
import { BeneficiaryManagementService } from "../beneficiary-management/service.js";
import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { SettingsManagementService } from "../settings-management/service.js";
import { TenantManagementService } from "../tenant-management/service.js";
import type { PayoutApprovalActionRequest, PayoutBatch, PayoutBatchCreateRequest, PayoutBulkCreateRequest, PayoutFileUpload, PayoutFileUploadCreateRequest, PayoutDispatchRequest, PublishedPayoutApprovalRequest, PublishedPayoutCreateRequest, PayoutRefundCreateRequest, PayoutSimulationRequest } from "./contracts.js";
export declare class PayoutManagementService {
    private readonly approvalMatrixManagementService;
    private readonly tenantManagementService;
    private readonly beneficiaryManagementService;
    private readonly identityAccessService;
    private readonly settingsManagementService;
    private readonly notificationsService;
    private readonly config;
    private readonly db;
    private readonly baseCurrency;
    constructor(approvalMatrixManagementService?: ApprovalMatrixManagementService, tenantManagementService?: TenantManagementService, beneficiaryManagementService?: BeneficiaryManagementService, identityAccessService?: IdentityAccessService, settingsManagementService?: SettingsManagementService, notificationsService?: NotificationsService);
    listBatches(filters?: {
        corporateTenantId?: string;
        bankTenantId?: string;
        corporateId?: string;
        state?: string;
        search?: string;
    }): Promise<{
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
        state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        totalAmount: {
            value: number;
            currency: "INR";
        };
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
        timeline: never[];
        items: never[];
    }[]>;
    getBatch(batchId: string): Promise<{
        batchId: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        primaryBeneficiaryId: string;
        primaryBeneficiaryName: null;
        createdByUserId: string;
        createdByRole: string | null;
        title: string;
        tag: string | null;
        remark: string | null;
        state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        totalAmount: {
            value: number;
            currency: "INR";
        };
        approvalComment: string | null;
        bankReference: string | null;
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
        dispatchedAt: string | null;
        completedAt: string | null;
        failureReason: string | null;
        approvalLevelsRequired: number;
        currentApprovalLevel: number;
        approvalRoles: string[];
        matchedApprovalMatrixIds: string[];
        timeline: {
            event: "approved" | "rejected" | "created" | "submitted";
            role: string | null;
            userId: string | null;
            userName: string | null;
            at: string | null;
        }[];
        items: {
            itemId: string;
            beneficiaryId: string;
            amount: {
                value: number;
                currency: "INR";
            };
            purpose: string;
            state: "sent_to_bank" | "failed" | "pending" | "processed";
            bankReference: string | null;
            failureReason: string | null;
            processedAt: string | null;
        }[];
    } | null>;
    createBatch(payload: PayoutBatchCreateRequest): Promise<{
        error: "forbidden";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "bank_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_transaction_reference";
        transactionReference: string;
        existingState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_corporate_mismatch";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_approved";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_inactive";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "single_transaction_limit_exceeded";
        limit: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "daily_cumulative_limit_exceeded";
        limit: number;
        currentTotal: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
    }>;
    createBulkBatches(payload: PayoutBulkCreateRequest): Promise<{
        error: "forbidden";
        fileName?: undefined;
        fileUpload?: undefined;
        limit?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_file_name";
        fileName: string;
        fileUpload: {
            uploadId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            fileName: string;
            uploadedByUserId: string;
            uploadedByRole: string | null;
            uploadedByName: string | null;
            status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
            remark: string | null;
            totalRows: number;
            createdCount: number;
            rejectedCount: number;
            uploadedAt: string | null;
        } | null | undefined;
        limit?: undefined;
        data?: undefined;
    } | {
        error: "bulk_upload_row_limit_exceeded";
        limit: number;
        fileUpload: {
            uploadId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            fileName: string;
            uploadedByUserId: string;
            uploadedByRole: string | null;
            uploadedByName: string | null;
            status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
            remark: string | null;
            totalRows: number;
            createdCount: number;
            rejectedCount: number;
            uploadedAt: string | null;
        } | null | undefined;
        fileName?: undefined;
        data?: undefined;
    } | {
        data: {
            created: PayoutBatch[];
            rejected: {
                rowNumber: number;
                transactionReference: string;
                reason: string;
            }[];
            fileUpload: {
                uploadId: string;
                bankTenantId: string;
                corporateTenantId: string;
                corporateId: string | null;
                fileName: string;
                uploadedByUserId: string;
                uploadedByRole: string | null;
                uploadedByName: string | null;
                status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
                remark: string | null;
                totalRows: number;
                createdCount: number;
                rejectedCount: number;
                uploadedAt: string | null;
            } | null | undefined;
            summary: {
                totalRows: number;
                createdCount: number;
                rejectedCount: number;
            };
        };
        error?: undefined;
        fileName?: undefined;
        fileUpload?: undefined;
        limit?: undefined;
    }>;
    acceptBulkFileUpload(payload: PayoutBulkCreateRequest): Promise<{
        error: "forbidden";
        fileName?: undefined;
        fileUpload?: undefined;
        limit?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_file_name";
        fileName: string;
        fileUpload: {
            uploadId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            fileName: string;
            uploadedByUserId: string;
            uploadedByRole: string | null;
            uploadedByName: string | null;
            status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
            remark: string | null;
            totalRows: number;
            createdCount: number;
            rejectedCount: number;
            uploadedAt: string | null;
        } | null | undefined;
        limit?: undefined;
        data?: undefined;
    } | {
        error: "bulk_upload_row_limit_exceeded";
        limit: number;
        fileUpload: {
            uploadId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            fileName: string;
            uploadedByUserId: string;
            uploadedByRole: string | null;
            uploadedByName: string | null;
            status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
            remark: string | null;
            totalRows: number;
            createdCount: number;
            rejectedCount: number;
            uploadedAt: string | null;
        } | null | undefined;
        fileName?: undefined;
        data?: undefined;
    } | {
        data: {
            fileUpload: {
                uploadId: string;
                bankTenantId: string;
                corporateTenantId: string;
                corporateId: string | null;
                fileName: string;
                uploadedByUserId: string;
                uploadedByRole: string | null;
                uploadedByName: string | null;
                status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
                remark: string | null;
                totalRows: number;
                createdCount: number;
                rejectedCount: number;
                uploadedAt: string | null;
            } | null;
            summary: {
                totalRows: number;
                createdCount: number;
                rejectedCount: number;
            };
        };
        error?: undefined;
        fileName?: undefined;
        fileUpload?: undefined;
        limit?: undefined;
    }>;
    createPublishedTransaction(payload: PublishedPayoutCreateRequest): Promise<{
        error: "forbidden";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "bank_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_transaction_reference";
        transactionReference: string;
        existingState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_corporate_mismatch";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_approved";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_inactive";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "single_transaction_limit_exceeded";
        limit: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "daily_cumulative_limit_exceeded";
        limit: number;
        currentTotal: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
    } | {
        error: "approval_action_in_progress";
    } | {
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    } | {
        error: "actor_not_found";
    }>;
    createAndSubmitBatch(payload: PayoutBatchCreateRequest): Promise<{
        error: "forbidden";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "bank_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_transaction_reference";
        transactionReference: string;
        existingState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_corporate_mismatch";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_approved";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_inactive";
        beneficiaryId: string;
        transactionReference?: undefined;
        existingState?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "single_transaction_limit_exceeded";
        limit: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        currentTotal?: undefined;
        data?: undefined;
    } | {
        error: "daily_cumulative_limit_exceeded";
        limit: number;
        currentTotal: number;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        transactionReference?: undefined;
        existingState?: undefined;
        beneficiaryId?: undefined;
        limit?: undefined;
        currentTotal?: undefined;
    } | {
        error: "approval_action_in_progress";
    } | {
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    }>;
    authorizePublishedTransaction(batchId: string, payload: PublishedPayoutApprovalRequest): Promise<{
        error: "approval_action_in_progress";
    } | {
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    } | {
        error: "actor_not_found";
    }>;
    applyApprovalAction(batchId: string, payload: PayoutApprovalActionRequest): Promise<{
        error: "approval_action_in_progress";
    } | {
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    }>;
    dispatchBatch(batchId: string, payload: PayoutDispatchRequest): Promise<{
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    }>;
    listRefunds(filters?: {
        corporateTenantId?: string;
        batchId?: string;
        corporateId?: string;
    }): Promise<{
        refundId: string;
        batchId: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        requestedByUserId: string;
        amount: number;
        reason: string;
        state: "approved" | "rejected" | "processed" | "requested" | "under_review";
        createdAt: string | null;
        processedAt: string | null;
    }[]>;
    listFileUploads(filters?: {
        corporateTenantId?: string;
        corporateId?: string;
        bankTenantId?: string;
    }): Promise<PayoutFileUpload[]>;
    getFileUpload(uploadId: string): Promise<{
        uploadId: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        fileName: string;
        uploadedByUserId: string;
        uploadedByRole: string | null;
        uploadedByName: string | null;
        status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
        remark: string | null;
        totalRows: number;
        createdCount: number;
        rejectedCount: number;
        uploadedAt: string | null;
    } | null>;
    recordFileUpload(payload: PayoutFileUploadCreateRequest, executor?: DatabaseExecutor): Promise<{
        error: "forbidden";
        data?: undefined;
    } | {
        data: {
            uploadId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            fileName: string;
            uploadedByUserId: string;
            uploadedByRole: string | null;
            uploadedByName: string | null;
            status: "rejected" | "failed" | "processing" | "successful" | "partially_successful";
            remark: string | null;
            totalRows: number;
            createdCount: number;
            rejectedCount: number;
            uploadedAt: string | null;
        };
        error?: undefined;
    }>;
    processAcceptedFileUpload(uploadId: string): Promise<{
        created: PayoutBatch[];
        rejected: {
            rowNumber: number;
            transactionReference: string;
            reason: string;
        }[];
    } | undefined>;
    createRefund(payload: PayoutRefundCreateRequest): Promise<{
        error: "bank_not_found";
        currentState?: undefined;
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        currentState?: undefined;
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        currentState?: undefined;
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_found";
        currentState?: undefined;
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "batch_corporate_mismatch";
        currentState?: undefined;
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "batch_not_refundable";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
        batchAmount?: undefined;
        data?: undefined;
    } | {
        error: "refund_amount_exceeds_batch";
        batchAmount: number;
        currentState?: undefined;
        data?: undefined;
    } | {
        data: {
            refundId: string;
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            requestedByUserId: string;
            amount: number;
            reason: string;
            state: "approved" | "rejected" | "processed" | "requested" | "under_review";
            createdAt: string | null;
            processedAt: string | null;
        };
        error?: undefined;
        currentState?: undefined;
        batchAmount?: undefined;
    }>;
    simulateBankResponse(batchId: string, payload: PayoutSimulationRequest): Promise<{
        error: "batch_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "paid" | "failed";
        data?: undefined;
    } | {
        data: {
            batchId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            primaryBeneficiaryId: string;
            primaryBeneficiaryName: null;
            createdByUserId: string;
            createdByRole: string | null;
            title: string;
            tag: string | null;
            remark: string | null;
            state: "draft" | "pending_approval" | "partially_approved" | "approved" | "rejected" | "sent_to_bank" | "paid" | "failed";
            totalAmount: {
                value: number;
                currency: "INR";
            };
            approvalComment: string | null;
            bankReference: string | null;
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
            dispatchedAt: string | null;
            completedAt: string | null;
            failureReason: string | null;
            approvalLevelsRequired: number;
            currentApprovalLevel: number;
            approvalRoles: string[];
            matchedApprovalMatrixIds: string[];
            timeline: {
                event: "approved" | "rejected" | "created" | "submitted";
                role: string | null;
                userId: string | null;
                userName: string | null;
                at: string | null;
            }[];
            items: {
                itemId: string;
                beneficiaryId: string;
                amount: {
                    value: number;
                    currency: "INR";
                };
                purpose: string;
                state: "sent_to_bank" | "failed" | "pending" | "processed";
                bankReference: string | null;
                failureReason: string | null;
                processedAt: string | null;
            }[];
        } | null;
        error?: undefined;
        currentState?: undefined;
    }>;
    private resolveNextState;
    private mapBatchListRow;
    private mapBatchRow;
    private buildTimeline;
    private mapFileUploadRow;
    private findFileUploadByName;
    private generateBankReference;
    private findBatchByReference;
    private getCurrentDailyCumulativeAmount;
    private initializeApprovalContext;
    private getApprovalContextRow;
    private getRolesForLevel;
    private appendTransactionOutboxEvent;
}
