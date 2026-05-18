import { IdentityAccessService } from "../identity-access/service.js";
import type { ApprovalMatrixCreateRequest } from "./contracts.js";
export declare class ApprovalMatrixManagementService {
    private readonly identityAccessService;
    private readonly db;
    constructor(identityAccessService?: IdentityAccessService);
    listMatrices(corporateTenantId?: string): Promise<{
        matrixId: string;
        corporateTenantId: string;
        entityType: "transaction";
        amountFrom: number;
        amountTo: number;
        approvalLevels: 1 | 2 | 3;
        roles: string[];
        status: "active" | "inactive";
        createdByUserId: string | null;
        createdByRole: string | null;
        createdAt: string | null;
        updatedAt: string | null;
    }[]>;
    createMatrix(payload: ApprovalMatrixCreateRequest): Promise<{
        error: "forbidden";
        roles?: undefined;
        data?: undefined;
    } | {
        error: "invalid_amount_range";
        roles?: undefined;
        data?: undefined;
    } | {
        error: "invalid_roles";
        roles: string[];
        data?: undefined;
    } | {
        data: {
            matrixId: string;
            corporateTenantId: string;
            entityType: "transaction";
            amountFrom: number;
            amountTo: number;
            approvalLevels: 1 | 2 | 3;
            roles: string[];
            status: "active" | "inactive";
            createdByUserId: string | null;
            createdByRole: string | null;
            createdAt: string | null;
            updatedAt: string | null;
        };
        error?: undefined;
        roles?: undefined;
    }>;
    buildTransactionApprovalPlan(corporateTenantId: string, amount: number): Promise<{
        approvalLevelsRequired: number;
        currentApprovalLevel: number;
        approvalRoles: string[];
        matchedApprovalMatrixIds: string[];
        rolesByLevel: {
            level: number;
            roles: string[];
        }[];
    }>;
}
