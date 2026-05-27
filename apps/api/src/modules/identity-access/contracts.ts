import { z } from "zod";

export const roleSchema = z.enum([
  "bank_admin",
  "bank_ops",
  "corporate_admin",
  "maker",
  "checker",
  "support_admin"
]);

export const corporatePermissionSchema = z.enum([
  "transaction.make",
  "transaction.checker",
  "beneficiary.make",
  "beneficiary.checker",
  "roles.make",
  "roles.checker",
  "user.make",
  "user.checker",
  "devportal.view",
  "devportal.edit",
  "settings.view",
  "settings.edit"
]);

export const corporateRoleNameSchema = z.string().min(2).max(80);

export const loginRequestSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(4)
});

/**
 * Strong password policy for new user creation.
 * RBI Master Direction requires complexity rules for banking applications:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export const strongPasswordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
  .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
  .refine((val) => /[0-9]/.test(val), "Password must contain at least one digit")
  .refine((val) => /[^A-Za-z0-9]/.test(val), "Password must contain at least one special character");

export const userStatusSchema = z.enum(["active", "inactive"]);
export const approvalStateSchema = z.enum([
  "pending_approval",
  "approved",
  "rejected"
]);

export const corporateUserCreateSchema = z.object({
  userId: z.string().min(3),
  createdByUserId: z.string().min(3),
  username: z.string().min(3),
  password: strongPasswordSchema,
  displayName: z.string().min(2),
  role: corporateRoleNameSchema,
  bankTenantId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3).optional(),
  status: userStatusSchema.default("inactive")
});

export const corporateRoleCreateSchema = z.object({
  roleId: z.string().min(3).optional(),
  createdByUserId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  name: corporateRoleNameSchema,
  description: z.string().min(2).optional(),
  permissions: z.array(corporatePermissionSchema).min(1),
  status: userStatusSchema.default("inactive")
});

export const corporateRoleUpdateSchema = z.object({
  actedByUserId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  name: corporateRoleNameSchema,
  description: z.string().min(2).optional(),
  permissions: z.array(corporatePermissionSchema).min(1),
  status: userStatusSchema
});

export const roleDebitAccountAccessUpdateSchema = z.object({
  actedByUserId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  roleName: corporateRoleNameSchema,
  debitAccountIds: z.array(z.string().min(3))
});

export const approvalActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  actedByUserId: z.string().min(3),
  comment: z.string().min(2).max(500).optional()
});

export type Role = z.infer<typeof roleSchema>;
export type CorporatePermission = z.infer<typeof corporatePermissionSchema>;
export type CorporateRoleName = z.infer<typeof corporateRoleNameSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type ApprovalState = z.infer<typeof approvalStateSchema>;
export type CorporateUserCreateRequest = z.infer<typeof corporateUserCreateSchema>;
export type CorporateRoleCreateRequest = z.infer<typeof corporateRoleCreateSchema>;
export type CorporateRoleUpdateRequest = z.infer<typeof corporateRoleUpdateSchema>;
export type RoleDebitAccountAccessUpdateRequest = z.infer<typeof roleDebitAccountAccessUpdateSchema>;
export type ApprovalActionRequest = z.infer<typeof approvalActionSchema>;

export type RoleDebitAccountAccess = {
  accessId: string;
  corporateTenantId: string;
  roleName: string;
  debitAccountId: string;
  status: string;
  createdAt: number | null;
  updatedAt: number | null;
};

export type AuthenticatedUser = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  tenantScope: "corporate";
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  status: "active";
  permissions: CorporatePermission[];
  token?: string;
};

export type CorporateUser = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  status: UserStatus;
  approvalState: ApprovalState;
  reviewComment: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  reviewedAt: number | null;
  reviewedByUserId: string | null;
  reviewedByRole: string | null;
};

export type CorporateRole = {
  roleId: string;
  corporateTenantId: string;
  name: string;
  description: string | null;
  status: UserStatus;
  permissions: CorporatePermission[];
  approvalState: ApprovalState;
  reviewComment: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  reviewedAt: number | null;
  reviewedByUserId: string | null;
  reviewedByRole: string | null;
};
