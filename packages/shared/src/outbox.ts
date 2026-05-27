import { getDatabasePool, type DatabaseExecutor } from "./db.js";
import type { DomainEventEnvelope } from "./events.js";
import type { AppConfig } from "./config.js";

export type OutboxEventStatus = "pending" | "published" | "failed" | "dead_letter";

export type OutboxEventRow = {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_key: string;
  version: number;
  occurred_at: number | null;
  payload_json: DomainEventEnvelope["payload"];
  status: OutboxEventStatus;
  attempt_count: number;
  last_error: string | null;
  published_at: number | null;
  created_at: number | null;
};

export async function appendOutboxEvent(
  executor: DatabaseExecutor,
  event: DomainEventEnvelope
) {
  await executor.query(
    `insert into outbox_events (
       event_id, aggregate_type, aggregate_id, event_type, event_key, version,
       occurred_at, payload_json, status, attempt_count, last_error, published_at, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending', 0, null, null, (extract(epoch from now()) * 1000)::bigint) `,
    [
      event.eventId,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      event.eventKey,
      event.version,
      event.occurredAt,
      JSON.stringify(event.payload)
    ]
  );
}

export async function listPendingOutboxEvents(
  config: AppConfig,
  options?: {
    limit?: number;
  }
) {
  const db = getDatabasePool(config);
  const limit = options?.limit ?? 50;
  const result = await db.query<OutboxEventRow>(
    `select event_id, aggregate_type, aggregate_id, event_type, event_key, version,
            occurred_at, payload_json, status, attempt_count, last_error, published_at, created_at
     from outbox_events
     where status in ('pending', 'failed')
     order by created_at asc nulls last, event_id asc
     limit $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    ...row,
    payload_json: row.payload_json ?? {}
  }));
}

export async function markOutboxEventPublished(config: AppConfig, eventId: string) {
  const db = getDatabasePool(config);
  await db.query(
    `update outbox_events
     set status = 'published',
         published_at = (extract(epoch from now()) * 1000)::bigint,
         last_error = null
     where event_id = $1`,
    [eventId]
  );
}

export async function markOutboxEventFailed(
  config: AppConfig,
  eventId: string,
  errorMessage: string,
  maxAttempts: number = 5
) {
  const db = getDatabasePool(config);
  await db.query(
    `update outbox_events
     set attempt_count = attempt_count + 1,
         status = case when attempt_count + 1 >= $3 then 'dead_letter'::text else 'failed'::text end,
         last_error = $2
     where event_id = $1`,
    [eventId, errorMessage, maxAttempts]
  );
}
