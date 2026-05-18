import { z } from "zod";
export declare const roleSchema: z.ZodEnum<["bank_admin", "bank_ops", "corporate_admin", "maker", "checker", "support_admin"]>;
export declare const corporatePermissionSchema: z.ZodEnum<["transaction.make", "transaction.checker", "beneficiary.make", "beneficiary.checker", "roles.make", "roles.checker", "user.make", "user.checker", "devportal.view", "devportal.edit", "settings.view", "settings.edit"]>;
export declare const corporateRoleNameSchema: z.ZodString;
export declare const loginRequestSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export declare const userStatusSchema: z.ZodEnum<["active", "inactive"]>;
export declare const approvalStateSchema: z.ZodEnum<["pending_approval", "approved", "rejected"]>;
export declare const corporateUserCreateSchema: z.ZodObject<{
    userId: z.ZodString;
    createdByUserId: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
    role: z.ZodString;
    bankTenantId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    bankTenantId: string;
    corporateTenantId: string;
    createdByUserId: string;
    role: string;
    username: string;
    password: string;
    userId: string;
    displayName: string;
    corporateId?: string | undefined;
}, {
    bankTenantId: string;
    corporateTenantId: string;
    createdByUserId: string;
    role: string;
    username: string;
    password: string;
    userId: string;
    displayName: string;
    status?: "active" | "inactive" | undefined;
    corporateId?: string | undefined;
}>;
export declare const corporateRoleCreateSchema: z.ZodObject<{
    roleId: z.ZodOptional<z.ZodString>;
    createdByUserId: z.ZodString;
    corporateTenantId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    permissions: z.ZodArray<z.ZodEnum<["transaction.make", "transaction.checker", "beneficiary.make", "beneficiary.checker", "roles.make", "roles.checker", "user.make", "user.checker", "devportal.view", "devportal.edit", "settings.view", "settings.edit"]>, "many">;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    corporateTenantId: string;
    createdByUserId: string;
    name: string;
    permissions: ("transaction.make" | "transaction.checker" | "beneficiary.make" | "beneficiary.checker" | "roles.make" | "roles.checker" | "user.make" | "user.checker" | "devportal.view" | "devportal.edit" | "settings.view" | "settings.edit")[];
    roleId?: string | undefined;
    description?: string | undefined;
}, {
    corporateTenantId: string;
    createdByUserId: string;
    name: string;
    permissions: ("transaction.make" | "transaction.checker" | "beneficiary.make" | "beneficiary.checker" | "roles.make" | "roles.checker" | "user.make" | "user.checker" | "devportal.view" | "devportal.edit" | "settings.view" | "settings.edit")[];
    status?: "active" | "inactive" | undefined;
    roleId?: string | undefined;
    description?: string | undefined;
}>;
export declare const approvalActionSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    actedByUserId: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}, {
    action: "approve" | "reject";
    actedByUserId: string;
    comment?: string | undefined;
}>;
export type Role = z.infer<typeof roleSchema>;
export type CorporatePermission = z.infer<typeof corporatePermissionSchema>;
export type CorporateRoleName = z.infer<typeof corporateRoleNameSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type ApprovalState = z.infer<typeof approvalStateSchema>;
export type CorporateUserCreateRequest = z.infer<typeof corporateUserCreateSchema>;
export type CorporateRoleCreateRequest = z.infer<typeof corporateRoleCreateSchema>;
export type ApprovalActionRequest = z.infer<typeof approvalActionSchema>;
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
    createdAt: string | null;
    updatedAt: string | null;
    reviewedAt: string | null;
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
    createdAt: string | null;
    updatedAt: string | null;
    reviewedAt: string | null;
    reviewedByUserId: string | null;
    reviewedByRole: string | null;
};
