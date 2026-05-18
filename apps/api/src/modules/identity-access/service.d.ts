import type { AppConfig } from "@cmsv01/shared/config";
import { NotificationsService } from "../notifications/service.js";
import type { ApprovalActionRequest, CorporatePermission, CorporateRoleCreateRequest, CorporateUserCreateRequest, LoginRequest } from "./contracts.js";
export declare class IdentityAccessService {
    private readonly config;
    private readonly notificationsService;
    private readonly db;
    constructor(config: AppConfig, notificationsService?: NotificationsService);
    getSupportedRoles(): ("bank_admin" | "bank_ops" | "corporate_admin" | "maker" | "checker" | "support_admin")[];
    login(payload: LoginRequest): Promise<{
        error: "invalid_credentials";
        data?: undefined;
    } | {
        data: {
            message: string;
            authMode: string;
            databaseConfigured: boolean;
            session: {
                userId: string;
                username: string;
                displayName: string;
                role: string;
                tenantScope: "corporate";
                bankTenantId: string;
                corporateTenantId: string;
                corporateId: string | null;
                status: "active";
                permissions: ("transaction.make" | "transaction.checker" | "beneficiary.make" | "beneficiary.checker" | "roles.make" | "roles.checker" | "user.make" | "user.checker" | "devportal.view" | "devportal.edit" | "settings.view" | "settings.edit")[];
            };
        };
        error?: undefined;
    }>;
    listCorporateUsers(corporateTenantId?: string, corporateId?: string): Promise<{
        userId: string;
        username: string;
        displayName: string;
        role: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        status: "active" | "inactive";
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        reviewedAt: string | null;
        reviewedByUserId: string | null;
        reviewedByRole: string | null;
    }[]>;
    getCorporateUserById(userId: string): Promise<{
        userId: string;
        username: string;
        displayName: string;
        role: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        status: "active" | "inactive";
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        reviewedAt: string | null;
        reviewedByUserId: string | null;
        reviewedByRole: string | null;
    } | null>;
    getCorporateUserByUsername(username: string): Promise<{
        userId: string;
        username: string;
        displayName: string;
        role: string;
        bankTenantId: string;
        corporateTenantId: string;
        corporateId: string | null;
        status: "active" | "inactive";
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        reviewedAt: string | null;
        reviewedByUserId: string | null;
        reviewedByRole: string | null;
    } | null>;
    getCorporateRoleByName(corporateTenantId: string, roleName: string): Promise<{
        roleId: string;
        corporateTenantId: string;
        name: string;
        description: string | null;
        status: "active" | "inactive";
        permissions: CorporatePermission[];
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        reviewedAt: string | null;
        reviewedByUserId: string | null;
        reviewedByRole: string | null;
    } | null>;
    getEffectivePermissionsForRole(corporateTenantId: string, roleName: string): Promise<("transaction.make" | "transaction.checker" | "beneficiary.make" | "beneficiary.checker" | "roles.make" | "roles.checker" | "user.make" | "user.checker" | "devportal.view" | "devportal.edit" | "settings.view" | "settings.edit")[]>;
    listApprovedTransactionCheckerRoleNames(corporateTenantId: string): Promise<string[]>;
    userHasPermission(userId: string, permission: CorporatePermission): Promise<boolean>;
    createCorporateUser(payload: CorporateUserCreateRequest): Promise<{
        error: "forbidden";
        data?: undefined;
    } | {
        error: "role_not_found";
        data?: undefined;
    } | {
        data: {
            userId: string;
            username: string;
            displayName: string;
            role: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            createdByUserId: string | null;
            createdByRole: string | null;
            createdAt: string | null;
            updatedAt: string | null;
            reviewedAt: string | null;
            reviewedByUserId: string | null;
            reviewedByRole: string | null;
        };
        error?: undefined;
    }>;
    listCorporateRoles(corporateTenantId?: string): Promise<{
        roleId: string;
        corporateTenantId: string;
        name: string;
        description: string | null;
        status: "active" | "inactive";
        permissions: CorporatePermission[];
        approvalState: "pending_approval" | "approved" | "rejected";
        reviewComment: string | null;
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        reviewedAt: string | null;
        reviewedByUserId: string | null;
        reviewedByRole: string | null;
    }[]>;
    createCorporateRole(payload: CorporateRoleCreateRequest): Promise<{
        error: "forbidden";
        data?: undefined;
    } | {
        data: {
            roleId: string;
            corporateTenantId: string;
            name: string;
            description: string | null;
            status: "active" | "inactive";
            permissions: CorporatePermission[];
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            createdByUserId: string | null;
            createdByRole: string | null;
            createdAt: string | null;
            updatedAt: string | null;
            reviewedAt: string | null;
            reviewedByUserId: string | null;
            reviewedByRole: string | null;
        };
        error?: undefined;
    }>;
    applyCorporateUserApprovalAction(userId: string, payload: ApprovalActionRequest): Promise<{
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "user_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "approved" | "rejected";
        data?: undefined;
    } | {
        data: {
            userId: string;
            username: string;
            displayName: string;
            role: string;
            bankTenantId: string;
            corporateTenantId: string;
            corporateId: string | null;
            status: "active" | "inactive";
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            createdByUserId: string | null;
            createdByRole: string | null;
            createdAt: string | null;
            updatedAt: string | null;
            reviewedAt: string | null;
            reviewedByUserId: string | null;
            reviewedByRole: string | null;
        };
        error?: undefined;
        currentState?: undefined;
    }>;
    applyCorporateRoleApprovalAction(roleId: string, payload: ApprovalActionRequest): Promise<{
        error: "forbidden";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "role_not_found";
        currentState?: undefined;
        data?: undefined;
    } | {
        error: "invalid_transition";
        currentState: "approved" | "rejected";
        data?: undefined;
    } | {
        data: {
            roleId: string;
            corporateTenantId: string;
            name: string;
            description: string | null;
            status: "active" | "inactive";
            permissions: CorporatePermission[];
            approvalState: "pending_approval" | "approved" | "rejected";
            reviewComment: string | null;
            createdByUserId: string | null;
            createdByRole: string | null;
            createdAt: string | null;
            updatedAt: string | null;
            reviewedAt: string | null;
            reviewedByUserId: string | null;
            reviewedByRole: string | null;
        };
        error?: undefined;
        currentState?: undefined;
    }>;
}
