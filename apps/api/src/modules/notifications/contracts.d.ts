import { z } from "zod";
export declare const notificationTargetSectionSchema: z.ZodEnum<["home", "transactions", "file-uploads", "beneficiaries", "approvals", "approval-matrices", "roles", "users", "devportal", "reports", "audit", "settings"]>;
export declare const notificationSchema: z.ZodObject<{
    notificationId: z.ZodString;
    corporateTenantId: z.ZodString;
    corporateId: z.ZodNullable<z.ZodString>;
    recipientUserId: z.ZodString;
    title: z.ZodString;
    message: z.ZodString;
    targetSection: z.ZodEnum<["home", "transactions", "file-uploads", "beneficiaries", "approvals", "approval-matrices", "roles", "users", "devportal", "reports", "audit", "settings"]>;
    entityType: z.ZodNullable<z.ZodString>;
    entityId: z.ZodNullable<z.ZodString>;
    readAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    message: string;
    corporateTenantId: string;
    corporateId: string | null;
    createdAt: string | null;
    notificationId: string;
    recipientUserId: string;
    targetSection: "approvals" | "home" | "transactions" | "file-uploads" | "beneficiaries" | "approval-matrices" | "roles" | "users" | "devportal" | "reports" | "audit" | "settings";
    entityType: string | null;
    entityId: string | null;
    readAt: string | null;
}, {
    title: string;
    message: string;
    corporateTenantId: string;
    corporateId: string | null;
    createdAt: string | null;
    notificationId: string;
    recipientUserId: string;
    targetSection: "approvals" | "home" | "transactions" | "file-uploads" | "beneficiaries" | "approval-matrices" | "roles" | "users" | "devportal" | "reports" | "audit" | "settings";
    entityType: string | null;
    entityId: string | null;
    readAt: string | null;
}>;
export declare const markNotificationReadSchema: z.ZodObject<{
    actedByUserId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actedByUserId: string;
}, {
    actedByUserId: string;
}>;
export type NotificationTargetSection = z.infer<typeof notificationTargetSectionSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type MarkNotificationReadRequest = z.infer<typeof markNotificationReadSchema>;
