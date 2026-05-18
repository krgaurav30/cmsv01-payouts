import { randomUUID } from "node:crypto";

export type DomainEventType =
  | "file.accepted"
  | "file.processed"
  | "transaction.command.accepted"
  | "transaction.created"
  | "transaction.submitted"
  | "transaction.partially_approved"
  | "transaction.approved"
  | "transaction.rejected"
  | "transaction.sent_to_bank"
  | "transaction.paid"
  | "transaction.failed";

export type AggregateType = "transaction" | "file-upload" | "transaction-command";

export type DomainEventEnvelope<TPayload = Record<string, unknown>> = {
  eventId: string;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: DomainEventType;
  eventKey: string;
  version: number;
  occurredAt: string;
  payload: TPayload;
};

export function createDomainEvent<TPayload>(input: {
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: DomainEventType;
  eventKey?: string;
  payload: TPayload;
  occurredAt?: Date;
  version?: number;
}) {
  const occurredAt = input.occurredAt ?? new Date();

  return {
    eventId: randomUUID(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    eventKey: input.eventKey ?? input.aggregateId,
    version: input.version ?? 1,
    occurredAt: occurredAt.toISOString(),
    payload: input.payload
  } satisfies DomainEventEnvelope<TPayload>;
}
