import { randomBytes } from "node:crypto";

import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

type PartnerWebhookRow = {
  webhook_id: string;
  label: string;
  webhook_url: string;
  description: string | null;
  event_types: string[] | null;
  status: "active" | "inactive";
  signing_secret: string;
  created_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  last_delivery_at: Date | null;
  last_delivery_status: string | null;
  last_delivery_http_status: number | null;
};

type PartnerWebhookDeliveryRow = {
  delivery_id: string;
  webhook_id: string;
  event_type: string;
  target_url: string;
  response_status: number | null;
  response_body: string | null;
  status: string;
  attempted_at: Date | null;
};

export const PARTNER_WEBHOOK_EVENTS = [
  "beneficiary.created",
  "beneficiary.authorized",
  "transaction.created",
  "transaction.authorized",
  "transaction.sent_to_bank",
  "transaction.paid",
  "transaction.failed",
  "file.upload.processed"
] as const;

export class WebhookManagementService {
  private readonly db = getDatabasePool(loadConfig());

  async listWebhooks() {
    const result = await this.db.query<PartnerWebhookRow>(
      `select webhook_id, label, webhook_url, description, event_types, status, signing_secret,
              created_by, created_at, updated_at, last_delivery_at, last_delivery_status,
              last_delivery_http_status
       from partner_webhooks
       order by updated_at desc nulls last, created_at desc nulls last, webhook_id desc`
    );

    return result.rows.map(mapWebhookRow);
  }

  async createWebhook(input: {
    label?: string;
    webhookUrl?: string;
    description?: string;
    eventTypes?: string[];
    status?: "active" | "inactive";
    createdBy?: string;
  }) {
    const webhookUrl = String(input.webhookUrl ?? "").trim();
    if (!webhookUrl) {
      return { error: "missing_webhook_url" as const };
    }

    try {
      const parsed = new URL(webhookUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { error: "invalid_webhook_url" as const };
      }
    } catch {
      return { error: "invalid_webhook_url" as const };
    }

    const dedupedEvents = [...new Set((input.eventTypes ?? []).map((item) => item.trim()))].filter(
      Boolean
    );
    if (dedupedEvents.length === 0) {
      return { error: "missing_event_types" as const };
    }

    const invalidEvents = dedupedEvents.filter(
      (eventType) => !PARTNER_WEBHOOK_EVENTS.includes(eventType as (typeof PARTNER_WEBHOOK_EVENTS)[number])
    );

    if (invalidEvents.length > 0) {
      return {
        error: "invalid_event_types" as const,
        eventTypes: invalidEvents
      };
    }

    const webhookId = `wh_${Date.now()}_${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0")}`;
    const signingSecret = `whsec_${randomBytes(18).toString("hex")}`;
    const label = String(input.label ?? "").trim() || "Partner webhook";
    const description = String(input.description ?? "").trim() || null;
    const status = input.status === "inactive" ? "inactive" : "active";
    const createdBy = String(input.createdBy ?? "").trim() || "bank-ops-001";

    const result = await this.db.query<PartnerWebhookRow>(
      `insert into partner_webhooks (
         webhook_id, label, webhook_url, description, event_types, status, signing_secret,
         created_by, created_at, updated_at, last_delivery_at, last_delivery_status, last_delivery_http_status
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), null, null, null)
       returning webhook_id, label, webhook_url, description, event_types, status, signing_secret,
                 created_by, created_at, updated_at, last_delivery_at, last_delivery_status,
                 last_delivery_http_status`,
      [webhookId, label, webhookUrl, description, dedupedEvents, status, signingSecret, createdBy]
    );

    return {
      data: mapWebhookRow(result.rows[0])
    };
  }

  async updateWebhookStatus(webhookId: string, status: "active" | "inactive") {
    const result = await this.db.query<PartnerWebhookRow>(
      `update partner_webhooks
       set status = $2,
           updated_at = now()
       where webhook_id = $1
       returning webhook_id, label, webhook_url, description, event_types, status, signing_secret,
                 created_by, created_at, updated_at, last_delivery_at, last_delivery_status,
                 last_delivery_http_status`,
      [webhookId, status]
    );

    return result.rows[0] ? mapWebhookRow(result.rows[0]) : null;
  }

  async listDeliveries(webhookId?: string) {
    const result = webhookId
      ? await this.db.query<PartnerWebhookDeliveryRow>(
          `select delivery_id, webhook_id, event_type, target_url, response_status, response_body,
                  status, attempted_at
           from partner_webhook_deliveries
           where webhook_id = $1
           order by attempted_at desc nulls last, delivery_id desc
           limit 50`,
          [webhookId]
        )
      : await this.db.query<PartnerWebhookDeliveryRow>(
          `select delivery_id, webhook_id, event_type, target_url, response_status, response_body,
                  status, attempted_at
           from partner_webhook_deliveries
           order by attempted_at desc nulls last, delivery_id desc
           limit 50`
        );

    return result.rows.map((row) => ({
      deliveryId: row.delivery_id,
      webhookId: row.webhook_id,
      eventType: row.event_type,
      targetUrl: row.target_url,
      responseStatus: row.response_status,
      responseBody: row.response_body,
      status: row.status,
      attemptedAt: row.attempted_at?.toISOString() ?? null
    }));
  }
}

function mapWebhookRow(row: PartnerWebhookRow) {
  return {
    webhookId: row.webhook_id,
    label: row.label,
    webhookUrl: row.webhook_url,
    description: row.description,
    eventTypes: row.event_types ?? [],
    status: row.status,
    signingSecret: row.signing_secret,
    maskedSigningSecret: maskSecret(row.signing_secret),
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
    lastDeliveryStatus: row.last_delivery_status,
    lastDeliveryHttpStatus: row.last_delivery_http_status
  };
}

function maskSecret(secret: string) {
  if (secret.length <= 10) {
    return "****";
  }

  return `${secret.slice(0, 10)}****${secret.slice(-4)}`;
}
