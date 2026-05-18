import { z } from "zod";
export const approvalMatrixStatusSchema = z.enum(["active", "inactive"]);
export const approvalMatrixCreateSchema = z.object({
    matrixId: z.string().min(3).optional(),
    corporateTenantId: z.string().min(3),
    createdByUserId: z.string().min(3),
    amountFrom: z.number().nonnegative(),
    amountTo: z.number().positive(),
    approvalLevels: z.number().int().min(1).max(3),
    roles: z.array(z.string().min(2)).min(1),
    status: approvalMatrixStatusSchema.default("active")
});
