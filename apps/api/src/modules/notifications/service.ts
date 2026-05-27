import { randomUUID } from "node:crypto";

import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import type {
  MarkNotificationReadRequest,
  Notification,
  NotificationTargetSection
} from "./contracts.js";
import type { CorporatePermission } from "../identity-access/contracts.js";

type NotificationRow = {
  notification_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  recipient_user_id: string;
  title: string;
  message: string;
  target_section: NotificationTargetSection;
  entity_type: string | null;
  entity_id: string | null;
  read_at: number | null;
  created_at: number | null;
};

export class NotificationsService {
  private readonly db = getDatabasePool(loadConfig());

  async listNotifications(recipientUserId: string) {
    const result = await this.db.query<NotificationRow>(
      `select notification_id, corporate_tenant_id, corporate_id, recipient_user_id, title,
              message, target_section, entity_type, entity_id, read_at, created_at
       from notifications
       where recipient_user_id = $1
       order by created_at desc nulls last, notification_id desc
       limit 50`,
      [recipientUserId]
    );

    return result.rows.map(mapNotificationRow);
  }

  async markNotificationRead(notificationId: string, payload: MarkNotificationReadRequest) {
    const result = await this.db.query<NotificationRow>(
      `update notifications
       set read_at = coalesce(read_at, (extract(epoch from now()) * 1000)::bigint)
       where notification_id = $1
         and recipient_user_id = $2
       returning notification_id, corporate_tenant_id, corporate_id, recipient_user_id, title,
                 message, target_section, entity_type, entity_id, read_at, created_at`,
      [notificationId, payload.actedByUserId]
    );

    return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
  }

  async markAllRead(actedByUserId: string) {
    await this.db.query(
      `update notifications
       set read_at = coalesce(read_at, (extract(epoch from now()) * 1000)::bigint)
       where recipient_user_id = $1
         and read_at is null`,
      [actedByUserId]
    );
  }

  async notifyUsers(payload: {
    corporateTenantId: string;
    corporateId?: string | null;
    recipientUserIds: string[];
    title: string;
    message: string;
    targetSection: NotificationTargetSection;
    entityType?: string | null;
    entityId?: string | null;
  }) {
    const uniqueRecipients = [...new Set(payload.recipientUserIds)].filter(Boolean);
    if (uniqueRecipients.length === 0) {
      return;
    }

    for (const recipientUserId of uniqueRecipients) {
      await this.db.query(
        `insert into notifications (
           notification_id, corporate_tenant_id, corporate_id, recipient_user_id, title,
           message, target_section, entity_type, entity_id, read_at, created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, (extract(epoch from now()) * 1000)::bigint)`,
        [
          randomUUID(),
          payload.corporateTenantId,
          payload.corporateId ?? null,
          recipientUserId,
          payload.title,
          payload.message,
          payload.targetSection,
          payload.entityType ?? null,
          payload.entityId ?? null
        ]
      );
    }
  }

  async getUserIdsForPermission(corporateTenantId: string, permission: CorporatePermission) {
    const result = await this.db.query<{ user_id: string }>(
      `select cu.user_id
       from corporate_users cu
       join corporate_roles cr
         on cr.corporate_tenant_id = cu.corporate_tenant_id
        and cr.name = cu.role
       where cu.corporate_tenant_id = $1
         and cu.status = 'active'
         and cu.approval_state = 'approved'
         and cr.status = 'active'
         and cr.approval_state = 'approved'
         and $2 = any(coalesce(cr.permissions, array[]::text[]))`,
      [corporateTenantId, permission]
    );

    return result.rows.map((row) => row.user_id);
  }

  async notifyPermissionRecipients(payload: {
    corporateTenantId: string;
    corporateId?: string | null;
    permission: CorporatePermission;
    title: string;
    message: string;
    targetSection: NotificationTargetSection;
    entityType?: string | null;
    entityId?: string | null;
  }) {
    const recipients = await this.getUserIdsForPermission(
      payload.corporateTenantId,
      payload.permission
    );

    await this.notifyUsers({
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId ?? null,
      recipientUserIds: recipients,
      title: payload.title,
      message: payload.message,
      targetSection: payload.targetSection,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null
    });
  }

  notifyPermissionRecipientsInBackground(payload: {
    corporateTenantId: string;
    corporateId?: string | null;
    permission: CorporatePermission;
    title: string;
    message: string;
    targetSection: NotificationTargetSection;
    entityType?: string | null;
    entityId?: string | null;
  }) {
    void this.notifyPermissionRecipients(payload).catch((error) => {
      console.error("Failed to create in-app notification", error);
    });
  }
}

function mapNotificationRow(row: NotificationRow) {
  return {
    notificationId: row.notification_id,
    corporateTenantId: row.corporate_tenant_id,
    corporateId: row.corporate_id,
    recipientUserId: row.recipient_user_id,
    title: row.title,
    message: row.message,
    targetSection: row.target_section,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at
  } satisfies Notification;
}
