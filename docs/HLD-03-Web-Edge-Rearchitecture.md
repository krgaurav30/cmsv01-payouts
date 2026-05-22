# HLD-03: Unified Web Edge Rearchitecture

## 1. Purpose

This note captures the codebase rearchitecture needed to align the runtime with the target topology:

- `Corporate Web -> Unified BFF -> Core Backend`
- `Bank Ops Web -> Unified BFF -> Core Backend`
- `Core Backend -> Postgres`
- `Core Backend -> Kafka -> Workers`

## 2. Findings From The Existing Codebase

Before this change, the repo already had the data and async backbone mostly in place:

- `apps/api` already owned domain APIs and orchestration
- `apps/worker` already handled outbox publishing, projections, and async callbacks
- `packages/shared` already centralized Postgres and Kafka primitives

The main gap was at the web edge:

- `apps/corporate-web` called the core backend directly
- bank-ops browser experiences were still hosted inside `apps/api`
- there was no explicit BFF boundary for aggregation, login brokering, or proxying

## 3. New Runtime Mapping

### 3.1 Corporate Web

- stays in `apps/corporate-web`
- now resolves its backend base through the BFF
- uses the BFF for login and operations dashboard bootstrap data

### 3.2 Bank Ops Web

- now has its own frontend app in `apps/bank-ops-web`
- presents bank ops browser entry points as first-class app pages instead of embedded legacy screens
- reaches bank ops tools only through the BFF

### 3.3 Unified BFF

- lives in `apps/bff`
- proxies `/v1/*` and `/bank/*` traffic to the core backend
- provides aggregated endpoints for web-specific read models, such as the corporate operations bootstrap payload
- becomes the single web-facing integration point for both browser surfaces

### 3.4 Core Backend

- remains in `apps/api`
- keeps domain route ownership
- no longer registers the legacy corporate browser routes
- continues to own Postgres and Kafka integration boundaries

### 3.5 Workers

- stay unchanged in `apps/worker`
- continue to consume domain events and update projections asynchronously

## 4. Why This Shape Helps

- Browser concerns are separated from domain concerns
- Corporate and bank-ops surfaces can evolve independently
- Web aggregation moves out of the core backend request handlers
- The topology now matches the intended deployable architecture without forcing premature microservice extraction

## 5. Incremental Follow-Ups

- remove now-obsolete legacy bank-app static UI assets after confirming they are no longer needed for fallback access
- move additional web composition concerns from frontend server components into explicit BFF contracts
- introduce auth/session validation in the BFF instead of passing fully trusted session context from the web tier
- formalize BFF-to-core API contracts with shared schemas
