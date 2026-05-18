import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { TenantManagementService } from "../tenant-management/service.js";
import type { Beneficiary, BeneficiaryApprovalActionRequest, BeneficiaryCreateRequest, PublishedBeneficiaryApprovalRequest, PublishedBeneficiaryCreateRequest, BeneficiaryStatusActionRequest, BeneficiaryUpdateRequest } from "./contracts.js";
export declare class BeneficiaryManagementService {
    private readonly tenantManagementService;
    private readonly identityAccessService;
    private readonly notificationsService;
    private readonly db;
    constructor(tenantManagementService?: TenantManagementService, identityAccessService?: IdentityAccessService, notificationsService?: NotificationsService);
    listBeneficiaries(filters?: {
        corporateTenantId?: string;
        corporateId?: string;
        status?: Beneficiary["status"];
        category?: string;
        search?: string;
    }): Promise<{
        beneficiaryId: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        name: string;
        accountNumber: string;
        ifsc: string;
        bankName: string;
        phoneNumber: string | null;
        category: string | null;
        tags: string[];
        status: "active" | "inactive";
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        lastUpdatedAt: string | null;
    }[]>;
    getBeneficiary(beneficiaryId: string): Promise<{
        beneficiaryId: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        name: string;
        accountNumber: string;
        ifsc: string;
        bankName: string;
        phoneNumber: string | null;
        category: string | null;
        tags: string[];
        status: "active" | "inactive";
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        lastUpdatedAt: string | null;
    } | null>;
    createBeneficiary(payload: BeneficiaryCreateRequest): Promise<{
        error: "forbidden";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "bank_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_beneficiary";
        beneficiaryId: string;
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
        beneficiaryId?: undefined;
    }>;
    createPublishedBeneficiary(payload: PublishedBeneficiaryCreateRequest): Promise<{
        error: "forbidden";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "bank_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "corporate_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "child_corporate_not_found";
        beneficiaryId?: undefined;
        data?: undefined;
    } | {
        error: "duplicate_beneficiary";
        beneficiaryId: string;
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
        beneficiaryId?: undefined;
    } | {
        error: "actor_not_found";
    }>;
    authorizePublishedBeneficiary(beneficiaryId: string, payload: PublishedBeneficiaryApprovalRequest): Promise<{
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "approved" | "rejected";
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
        currentState?: undefined;
    } | {
        error: "actor_not_found";
    }>;
    applyApprovalAction(beneficiaryId: string, payload: BeneficiaryApprovalActionRequest): Promise<{
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "approved" | "rejected";
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
        currentState?: undefined;
    }>;
    applyStatusAction(beneficiaryId: string, payload: BeneficiaryStatusActionRequest): Promise<{
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "beneficiary_not_approved";
        currentState: "pending_approval" | "rejected";
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
        currentState?: undefined;
    }>;
    updateBeneficiary(beneficiaryId: string, payload: BeneficiaryUpdateRequest): Promise<{
        error: "beneficiary_not_found";
        data?: undefined;
    } | {
        data: {
            beneficiaryId: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            name: string;
            accountNumber: string;
            ifsc: string;
            bankName: string;
            phoneNumber: string | null;
            category: string | null;
            tags: string[];
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            lastUpdatedAt: string | null;
        };
        error?: undefined;
    }>;
    deleteBeneficiary(beneficiaryId: string): Promise<{
        deleted: boolean;
    }>;
    private generateBeneficiaryId;
}
