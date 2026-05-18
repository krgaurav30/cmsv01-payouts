import { z } from "zod";

export const notificationTargetSectionSchema = z.enum([
  "home",
  "transactions",
  "file-uploads",
  "beneficiaries",
  "approvals",
  "approval-matrices",
  "roles",
  "users",
  "devportal",
  "reports",
  "audit",
  "settings"
]);

export const notificationSchema = z.object({
  notificationId: z.string().min(3),
  corporateTenantId: z.string().min(3),
  corporateId: z.string().min(3).nullable(),
  recipientUserId: z.string().min(3),
  title: z.string().min(1),
  message: z.string().min(1),
  targetSection: notificationTargetSectionSchema,
  entityType: z.string().min(1).nullable(),
  entityId: z.string().min(1).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string().nullable()
});

export const markNotificationReadSchema = z.object({
  actedByUserId: z.string().min(3)
});

export type NotificationTargetSection = z.infer<typeof notificationTargetSectionSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type MarkNotificationReadRequest = z.infer<typeof markNotificationReadSchema>;
