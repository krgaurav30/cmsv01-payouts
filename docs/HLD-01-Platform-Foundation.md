# HLD-01: Platform Foundation and Vertical Slicing

## 1. Purpose

This HLD defines the initial high-level architecture for the Banking Product prototype described in the PRD. It establishes the system shape, architectural principles, modular boundaries, deployment approach, and the first set of vertical slices to implement.

This document is intentionally biased toward:

- simplicity in the beginning
- open source or free-tier friendly tooling
- modular evolution without a rewrite
- future readiness for fault tolerance and throughput growth
- clean support for event-driven processing with Kafka

## 2. Key Decisions

- Architecture style: modular monolith first
- Product slicing strategy: vertical slicing
- Communication style: synchronous APIs for user-facing actions, Kafka for async workflows
- Primary database: PostgreSQL
- Cache: not used initially
- Containerization: not required initially
- Deployment model: single deployable application plus background workers
- File storage: local filesystem initially, object storage abstraction for later migration
- API style: REST with OpenAPI-first discipline

## 3. Why Vertical Slicing

Vertical slicing is the preferred starting model because this product is workflow-heavy and multi-actor. Each business capability needs UI, API, domain logic, events, audit trail, and persistence to be useful.

Compared with horizontal slicing, vertical slicing gives:

- faster delivery of end-to-end usable flows
- lower coordination overhead in early development
- clearer business ownership of modules
- easier testing of real product outcomes
- safer future extraction into services if needed

## 4. Target System Shape

The initial system will run as one application codebase with clearly separated modules and one or more worker processes consuming Kafka events.

### 4.1 Runtime Components

1. Web Application
- serves UI and REST APIs
- handles authentication, authorization, request validation, and orchestration of user-facing flows

2. Background Workers
- consume Kafka events
- process async work such as notifications, payout dispatch, webhook delivery, status updates, and reconciliation jobs

3. PostgreSQL
- system of record
- stores tenants, users, onboarding data, beneficiaries, payouts, approvals, audit logs, ledger entries, webhook records, and workflow state

4. Kafka
- async event backbone
- decouples transactional workflows from background processing

5. File Storage
- local file storage in early environments
- abstracted so it can later move to S3-compatible object storage

## 5. Architecture Principles

### 5.1 Modular Monolith First

The first version should not be split into many deployable services. A modular monolith keeps operations simple while preserving strong internal boundaries.

Each module should own:

- API handlers
- application services
- domain models and rules
- persistence logic
- emitted domain events

Modules interact through explicit interfaces and events, not shared hidden logic.

### 5.2 Event-Driven Where It Matters

Not every action needs asynchronous design. User-facing create/read/update flows can remain synchronous where possible. Async processing should be used where reliability, retries, decoupling, or eventual completion matters.

Kafka should be used for:

- payout submitted
- approval completed
- batch ready for dispatch
- payout dispatched to bank simulator
- payout status updated
- webhook scheduled
- webhook retry requested
- recon job started
- recon mismatch detected
- notification requested

### 5.3 Strong Auditability

Every meaningful state transition must be traceable. Audit logging is a first-class requirement, not an afterthought.

At minimum, the system should record:

- actor
- tenant
- target entity
- action
- timestamp
- before state summary where relevant
- after state summary where relevant
- correlation or request identifier

### 5.4 Future Readiness for 1000 TPS

The initial version can stay simple, but the design should not block future scale.

Required design rules:

- stateless web application
- database-friendly schema and indexing
- idempotent command handling
- append-oriented audit and event records
- worker-based async processing
- partition-friendly event keys in Kafka
- module boundaries that can later become services

## 6. Proposed Module Boundaries

The codebase should start with the following top-level modules.

1. `identity-access`
- users, roles, login, password flows, session handling

2. `tenant-management`
- bank tenant setup, corporate tenant setup, white-label settings, subdomain mapping

3. `corporate-onboarding`
- onboarding forms, document capture, bank review workflow, approval and rejection lifecycle

4. `beneficiary-management`
- beneficiary CRUD, bulk import, validation hooks

5. `approval-management`
- approval matrix configuration, approval requests, approval decisions

6. `payout-management`
- batch creation, item validation, lifecycle state management

7. `bank-connector`
- mock bank simulator integration, dispatch contracts, status callbacks

8. `ledger-recon`
- ledger events, transaction posting model, reconciliation workflows, exception handling

9. `notifications`
- email and in-app notifications

10. `developer-platform`
- API keys, webhooks, delivery logs, replay

11. `support-console`
- internal search, traceability, investigation tools

12. `platform-shared`
- shared primitives only
- examples: config, error model, auth middleware, event envelope, audit contract

## 7. Recommended First Delivery Order

The product should be built as vertical slices in this order:

1. Platform foundation + identity + tenant bootstrap
2. Corporate onboarding
3. Corporate self-service admin
4. Beneficiary management
5. Payout creation and approval
6. Mock bank dispatch and status ingestion
7. Webhooks and notifications
8. Ledger and reconciliation
9. Support console essentials

## 8. First Vertical Slice

The first vertical slice should be:

`Platform foundation + identity + tenant bootstrap + corporate onboarding`

This is the best starting point because it unlocks the rest of the product and creates the multi-tenant skeleton needed by every later flow.

### 8.1 Scope of Slice 1

- basic multi-tenant setup for bank and corporate tenants
- bank white-label settings
- subdomain-aware tenant resolution
- built-in auth for bank users and corporate users
- role model for bank admin, bank ops, corporate admin
- corporate onboarding form
- onboarding submission workflow
- bank review queue
- onboarding state transitions
- document upload and storage
- audit logging
- email notifications on onboarding state change

### 8.2 Out of Scope for Slice 1

- beneficiaries
- approval matrix depth beyond onboarding basics
- payout execution
- ledger posting
- reconciliation
- developer portal depth
- AI features

## 9. High-Level Request Flow

### 9.1 Synchronous Flow

1. User signs in through bank or corporate entry point
2. Application resolves tenant context
3. User performs action through UI or API
4. Module validates permissions and business rules
5. Transaction is stored in PostgreSQL
6. Audit record is written
7. If async follow-up is needed, event is published to Kafka
8. Response is returned to the user

### 9.2 Asynchronous Flow

1. Worker consumes Kafka event
2. Worker loads relevant business entity
3. Worker executes side effect
4. Worker updates status in PostgreSQL
5. Worker writes audit or operational event record
6. Worker publishes follow-up event if needed

## 10. Data Ownership Direction

The following data ownership model should guide schema design:

- `identity-access` owns users, credentials, sessions, role assignments
- `tenant-management` owns bank tenants, corporate tenants, branding, tenant relationships
- `corporate-onboarding` owns onboarding applications, documents, review comments, decisions
- `developer-platform` owns API keys, webhook endpoints, delivery attempts
- `notifications` owns templates, notification requests, delivery logs
- `ledger-recon` owns ledger entries, posting groups, recon runs, recon exceptions

Cross-module access should happen via APIs, application services, or stable read models, not direct uncontrolled coupling.

## 11. Reliability Patterns to Use Early

Even in the simple first version, these patterns should be present:

### 11.1 Idempotency

Use idempotency keys for:

- API-driven payout creation
- webhook ingestion
- event consumer processing where retries are possible

### 11.2 Transaction Plus Event Publishing Discipline

To avoid database and Kafka inconsistency, the application should use an outbox pattern or an equivalent reliable event publishing mechanism.

### 11.3 Retry With Limits

Background jobs should retry transient failures with backoff. Permanent business failures should move to a visible failed state, not loop forever.

### 11.4 Immutable Audit Trail

Audit entries should be append-only.

## 12. Deployment View

### 12.1 Initial Non-Docker Setup

The system can start without Docker using:

- application process running directly on the host
- worker process running directly on the host
- PostgreSQL installed locally or on a free-tier hosted environment
- Kafka running as a separately managed dependency

This keeps local development simpler while preserving the production shape.

### 12.2 Future Evolution

Later, the same modular structure can evolve into:

- multiple stateless app instances
- multiple worker instances
- separate deployment units for heavy modules if needed
- object storage migration
- optional cache introduction

## 13. Security and Access Direction

For the prototype:

- built-in authentication is acceptable
- role-based access control is mandatory
- tenant isolation must be enforced at application and data access layers
- password reset and invite flows must be auditable
- sensitive secrets such as API keys must be stored securely and never logged in plain form

## 14. Observability Direction

The system should include basic observability from the start:

- structured logs
- request correlation id
- event correlation id
- job processing logs
- admin-visible audit trail
- operational dashboards can remain simple initially

## 15. Technology Direction

The exact framework can be finalized later, but the architecture expects:

- backend framework with strong modularity and PostgreSQL support
- frontend framework that supports multiple UI surfaces cleanly
- Kafka client with consumer group support
- PostgreSQL migration tooling
- OpenAPI generation or contract maintenance

## 16. Risks and Mitigations

### Risk 1: Overcomplicating too early

Mitigation:
- start as a modular monolith
- use Kafka only for true async boundaries

### Risk 2: Weak tenant isolation

Mitigation:
- tenant-aware access model from the first schema and service layer
- explicit tenant resolution on every request path

### Risk 3: Kafka complexity in local development

Mitigation:
- keep Kafka topic design simple initially
- minimize number of consumers in slice 1

### Risk 4: Future scale blocked by early shortcuts

Mitigation:
- enforce idempotency, audit, event boundaries, and modular ownership now

## 17. Outcome

This HLD recommends a modular monolith with vertical slicing, PostgreSQL as the source of truth, Kafka as the async backbone, no cache initially, and no Docker requirement initially.

The first implementation slice should be the tenant and onboarding foundation because it creates the base on which all payout, approval, and bank operations workflows depend.
