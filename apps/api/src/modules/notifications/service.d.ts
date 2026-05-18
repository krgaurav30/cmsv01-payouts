import type { MarkNotificationReadRequest, NotificationTargetSection } from "./contracts.js";
import type { CorporatePermission } from "../identity-access/contracts.js";
export declare class NotificationsService {
    private readonly db;
    listNotifications(recipientUserId: string): Promise<{
        notificationId: string;
        corporateTenantId: string;
        corporateId: string | null;
        recipientUserId: string;
        title: string;
        message: string;
        targetSection: "approvals" | "home" | "transactions" | "file-uploads" | "beneficiaries" | "approval-matrices" | "roles" | "users" | "devportal" | "reports" | "audit" | "settings";
        entityType: string | null;
        entityId: string | null;
        readAt: string | null;
        createdAt: string | null;
    }[]>;
    markNotificationRead(notificationId: string, payload: MarkNotificationReadRequest): Promise<{
        notificationId: string;
        corporateTenantId: string;
        corporateId: string | null;
        recipientUserId: string;
        title: string;
        message: string;
        targetSection: "approvals" | "home" | "transactions" | "file-uploads" | "beneficiaries" | "approval-matrices" | "roles" | "users" | "devportal" | "reports" | "audit" | "settings";
        entityType: string | null;
        entityId: string | null;
        readAt: string | null;
        createdAt: string | null;
    } | null>;
    markAllRead(actedByUserId: string): Promise<void>;
    notifyUsers(payload: {
        corporateTenantId: string;
        corporateId?: string | null;
        recipientUserIds: string[];
        title: string;
        message: string;
        targetSection: NotificationTargetSection;
        entityType?: string | null;
        entityId?: string | null;
    }): Promise<void>;
    getUserIdsForPermission(corporateTenantId: string, permission: CorporatePermission): Promise<string[]>;
    notifyPermissionRecipients(payload: {
        corporateTenantId: string;
        corporateId?: string | null;
        permission: CorporatePermission;
        title: string;
        message: string;
        targetSection: NotificationTargetSection;
        entityType?: string | null;
        entityId?: string | null;
    }): Promise<void>;
    notifyPermissionRecipientsInBackground(payload: {
        corporateTenantId: string;
        corporateId?: string | null;
        permission: CorporatePermission;
        title: string;
        message: string;
        targetSection: NotificationTargetSection;
        entityType?: string | null;
        entityId?: string | null;
    }): void;
}
