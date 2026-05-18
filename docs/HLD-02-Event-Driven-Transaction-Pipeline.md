# HLD-02: Event-Driven Transaction Pipeline

## 1. Purpose

This HLD defines how the current transaction flow should evolve from a synchronous modular-monolith flow into an event-driven, high-throughput pipeline suitable for heavy UI, API, and bulk-file traffic.

The goal is to make transaction intake fast, isolate module failures, and support future scale without requiring a full microservice breakup immediately.

This design is intentionally shaped around:

- PostgreSQL as system of record
- Kafka as event backbone
- modular monolith business logic
- worker-driven asynchronous processing
- strong idempotency and traceability
- low-latency intake with eventual completion

## 2. Why We Need This

Today, transaction creation is still too request-coupled:

- UI waits for too much work inline
- notifications and approval routing are too close to the request path
- bulk upload and API intake still depend too much on synchronous orchestration
- one slow module can still impact the perceived speed of another

For a Stripe-like operating model, requests should be accepted quickly and then processed through a reliable asynchronous pipeline.

## 3. Target Outcome

The system should behave like this:

1. UI, API, or file upload submits a transaction request
2. system performs light validation and persists the command
3. system immediately acknowledges acceptance
4. domain events are published from an outbox
5. background workers process approval routing, notifications, bank dispatch, webhook delivery, and downstream projections
6. clients track progress through UI polling, status APIs, and later webhooks

This makes the product:

- fast at intake
- resilient under load
- easier to retry safely
- less tightly coupled
- easier to scale horizontally

## 4. Scope

This HLD covers the transaction lifecycle only:

- transaction create from UI
- transaction create from API
- transaction create from bulk file upload
- approval progression
- bank dispatch
- bank response processing
- notifications
- audit propagation
- webhook readiness

It does not require immediate service decomposition.

## 5. Architectural Model

### 5.1 Pattern

Use:

- modular monolith for domain ownership
- Postgres transactional outbox for reliable event publication
- Kafka for async event transport
- workers for domain side effects and background progression

### 5.2 Core Principle

The request path should only do the minimum:

- validate
- persist
- record audit
- create outbox event
- return quickly

Everything else should happen asynchronously.

## 6. Runtime Components

1. `Intake API`
- receives UI, API, and bulk upload transaction requests
- performs lightweight synchronous validation
- writes commands and outbox rows transactionally

2. `Outbox Publisher`
- reads unpublished outbox rows from Postgres
- publishes them to Kafka
- marks them as published safely

3. `Approval Worker`
- consumes transaction-created and transaction-submitted events
- evaluates approval matrix
- creates approval assignments
- advances state to pending or partially approved

4. `Notification Worker`
- consumes domain events
- creates bell notifications
- later sends email and push events

5. `Bank Dispatch Worker`
- consumes approved transaction events
- sends eligible transactions to the bank connector
- updates status to sent_to_bank

6. `Bank Response Worker`
- consumes mock bank callbacks or scheduled polling results
- marks transaction as paid or failed

7. `Projection / Read Model Worker`
- updates lightweight query tables used by the UI for fast lists and summaries

## 7. Transaction Lifecycle

The simplified business state machine remains:

- `draft`
- `pending_approval`
- `partially_approved`
- `approved`
- `rejected`
- `sent_to_bank`
- `paid`
- `failed`

The difference is that state progression is now driven by workers and events rather than inline orchestration.

## 8. Ingestion Channels

### 8.1 UI Channel

The corporate UI submits a transaction command:

- transaction reference
- beneficiary
- amount
- tag
- remark

API returns quickly with:

- transaction UUID
- transaction reference
- current status
- accepted timestamp

### 8.2 Partner API Channel

Partner API submits the same command shape plus actor context.

API should respond with:

- accepted
- transaction UUID
- current state
- polling endpoint

### 8.3 Bulk File Channel

Bulk upload should become a two-stage flow:

1. file accepted
2. rows processed asynchronously

The file record becomes the tracking anchor, while row-level transactions are created in background.

## 9. Required New Data Structures

### 9.1 Transaction Command Table

Store accepted transaction commands before full orchestration.

Suggested table:

- `transaction_commands`
  - `command_id`
  - `channel` (`ui`, `api`, `file`)
  - `bank_tenant_id`
  - `corporate_tenant_id`
  - `corporate_id`
  - `actor_user_id`
  - `transaction_reference`
  - `payload_json`
  - `status`
  - `received_at`

### 9.2 Transactional Outbox

Suggested table:

- `outbox_events`
  - `event_id`
  - `aggregate_type`
  - `aggregate_id`
  - `event_type`
  - `event_key`
  - `payload_json`
  - `status`
  - `attempt_count`
  - `published_at`
  - `created_at`

### 9.3 Approval Assignment Table

Suggested table:

- `transaction_approval_assignments`
  - `assignment_id`
  - `batch_id`
  - `approval_level`
  - `role_name`
  - `status`
  - `acted_by_user_id`
  - `acted_at`

This allows us to support overlapping rules, multiple roles, and future escalation.

### 9.4 Read Models

Suggested fast-read tables:

- `transaction_list_projection`
- `approval_queue_projection`
- `file_upload_projection`

These should be optimized for UI speed, not domain complexity.

## 10. Event Model

### 10.1 First Event Set

Start with these domain events:

- `transaction.command.accepted`
- `transaction.created`
- `transaction.submitted`
- `transaction.approval.level.completed`
- `transaction.partially_approved`
- `transaction.approved`
- `transaction.rejected`
- `transaction.sent_to_bank`
- `transaction.paid`
- `transaction.failed`
- `file.accepted`
- `file.processed`

### 10.2 Event Keys

Use stable keys for Kafka partitioning:

- transaction events: `batch_id`
- file events: `upload_id`
- approval events: `batch_id`

This keeps ordering safe per transaction or file.

## 11. Outbox Pattern

### 11.1 Why

We cannot safely rely on:

- write business record
- publish Kafka event

as two separate operations in the request path.

That risks data loss when the database write succeeds but Kafka publish fails.

### 11.2 Rule

Every transaction-related mutation that should emit an event must:

1. update domain tables
2. insert an outbox row
3. commit once

Then a separate publisher moves the event to Kafka.

This is non-negotiable for reliability.

## 12. Idempotency Rules

### 12.1 Create Transaction

Transaction reference should remain the logical business idempotency key within:

- corporate tenant
- child corporate

If duplicate-reference check is on:

- reject duplicate command before transaction creation

If duplicate-reference check is off:

- still store a unique command id
- allow duplicate business references intentionally

### 12.2 Event Handlers

Every worker must be idempotent:

- reprocessing the same event should not duplicate state changes
- handler should check current state before mutating
- approval assignment creation should be conflict-safe
- notifications should dedupe on event id + recipient

## 13. Failure Isolation

This is critical.

A failure in one module must not block another.

### 13.1 Required Behavior

- notification failure must not block transaction creation
- webhook failure must not block approval completion
- file-processing failure must not block UI browsing
- projection failure must not corrupt system of record

### 13.2 How

- asynchronous workers
- dead-letter strategy
- retry with backoff
- independent projections
- per-module failure monitoring

## 14. Race Conditions

Approval race handling must remain strict.

If two checkers act at the same time:

- first successful row lock wins
- second actor receives:
  - `An action is already in progress by another user, please recheck the status after sometime`

That rule stays valid in the async model too.

## 15. Performance Goals

### 15.1 Request Path

Transaction create path should target:

- basic validation
- one DB transaction
- no waiting on notification creation
- no waiting on read-model rebuild
- no waiting on Kafka producer directly if using outbox

### 15.2 UI Read Path

UI tables should read from:

- lightweight list endpoints
- minimal joins
- projection tables where needed

UI should never depend on full transaction detail loading for list rendering.

## 16. Recommended Implementation Order

### Phase 1

- create `outbox_events`
- create outbox publisher worker
- emit transaction domain events from current write paths
- move notifications fully off request path

### Phase 2

- split transaction create into command acceptance + worker orchestration
- add approval assignment table
- move approval routing to worker

### Phase 3

- move bulk upload row creation to async background processing
- add file progress states and row-level event tracking

### Phase 4

- move bank dispatch and bank response handling fully behind Kafka events
- add webhook delivery worker

### Phase 5

- add projection tables for transactions, approvals, and uploads
- tune read performance for large volumes

## 17. What Is Needed Next

To start this architecture shift, we need:

1. `outbox_events` migration
2. `transaction_approval_assignments` migration
3. Kafka publisher worker
4. event envelope standard
5. transaction create command service
6. notification worker migration off synchronous path
7. projection strategy for list views

## 18. Recommendation

Do not break the whole system into microservices yet.

Instead:

- keep the modular monolith
- make the transaction lifecycle event-driven first
- move all non-essential side effects off the request path

This gives us the Stripe-like async shape we want while keeping the current codebase manageable.
