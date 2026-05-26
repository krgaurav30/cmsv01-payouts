import { z } from "zod";

export const approvalMatrixStatusSchema = z.enum(["active", "inactive"]);

export const approvalMatrixCreateSchema = z.object({
  matrixId: z.string().min(3).optional(),
  name: z.string().min(2),
  corporateTenantId: z.string().min(3),
  subscriptionId: z.string().min(3),
  createdByUserId: z.string().min(3),
  debitAccountIds: z.array(z.string().min(1)).min(1),
  amountFrom: z.number().int().nonnegative(),
  amountTo: z.number().int().positive(),
  approvalLevels: z.number().int().min(1).max(3),
  roles: z.array(z.string().min(2)).min(1),
  status: approvalMatrixStatusSchema.default("active")
});

export const approvalMatrixUpdateSchema = approvalMatrixCreateSchema.omit({
  matrixId: true
});

export type ApprovalMatrixStatus = z.infer<typeof approvalMatrixStatusSchema>;
export type ApprovalMatrixCreateRequest = z.infer<typeof approvalMatrixCreateSchema>;
export type ApprovalMatrixUpdateRequest = z.infer<typeof approvalMatrixUpdateSchema>;

export type ApprovalMatrix = {
  matrixId: string;
  name: string;
  corporateTenantId: string;
  subscriptionId: string | null;
  packageCode: string | null;
  packageDisplayName: string | null;
  debitAccountIds: string[];
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
  debitAccountId: string | null;
  rolesByLevel: Array<{
    level: number;
    roles: string[];
  }>;
};
