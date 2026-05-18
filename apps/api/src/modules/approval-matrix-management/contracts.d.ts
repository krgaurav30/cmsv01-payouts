import { z } from "zod";
export declare const approvalMatrixStatusSchema: z.ZodEnum<["active", "inactive"]>;
export declare const approvalMatrixCreateSchema: z.ZodObject<{
    matrixId: z.ZodOptional<z.ZodString>;
    corporateTenantId: z.ZodString;
    createdByUserId: z.ZodString;
    amountFrom: z.ZodNumber;
    amountTo: z.ZodNumber;
    approvalLevels: z.ZodNumber;
    roles: z.ZodArray<z.ZodString, "many">;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    corporateTenantId: string;
    createdByUserId: string;
    roles: string[];
    amountFrom: number;
    amountTo: number;
    approvalLevels: number;
    matrixId?: string | undefined;
}, {
    corporateTenantId: string;
    createdByUserId: string;
    roles: string[];
    amountFrom: number;
    amountTo: number;
    approvalLevels: number;
    status?: "active" | "inactive" | undefined;
    matrixId?: string | undefined;
}>;
export type ApprovalMatrixStatus = z.infer<typeof approvalMatrixStatusSchema>;
export type ApprovalMatrixCreateRequest = z.infer<typeof approvalMatrixCreateSchema>;
export type ApprovalMatrix = {
    matrixId: string;
    corporateTenantId: string;
    entityType: "transaction";
    amountFrom: number;
    amountTo: number;
    approvalLevels: 1 | 2 | 3;
    roles: string[];
    status: ApprovalMatrixStatus;
    createdByUserId: string | null;
    createdByRole: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};
export type ApprovalPlanSnapshot = {
    approvalLevelsRequired: number;
    currentApprovalLevel: number;
    approvalRoles: string[];
    matchedApprovalMatrixIds: string[];
    rolesByLevel: Array<{
        level: number;
        roles: string[];
    }>;
};
