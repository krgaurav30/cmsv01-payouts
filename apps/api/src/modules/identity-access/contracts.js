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
    password: z.string().min(4),
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
export const approvalActionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    actedByUserId: z.string().min(3),
    comment: z.string().min(2).max(500).optional()
});
