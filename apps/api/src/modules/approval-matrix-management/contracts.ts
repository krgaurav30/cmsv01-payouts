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
