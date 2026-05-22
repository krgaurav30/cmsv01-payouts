# HLD-04: Package Architecture Migration Roadmap

## 1. Purpose

This note maps the locked package architecture LLD onto the current codebase and breaks the required rearchitecture into implementation phases.

It answers four questions:

1. where the current repo already aligns with the target model
2. where the current model conflicts with the target model
3. what changes are required module by module
4. in what order those changes should be delivered

This is a migration and delivery document, not a schema or endpoint spec.

## 2. Current Baseline

The repo's runtime topology is already compatible with a real banking product:

- `apps/corporate-web` and `apps/bank-ops-web` are the user-facing surfaces
- `apps/bff` is the web-facing aggregation and proxy layer
- `apps/api` is the modular monolith that owns domain logic
- `apps/worker` already supports async processing through Kafka and Postgres projections
- `packages/shared` already centralizes config, DB, Kafka, outbox, and tenant primitives

The main gap is not runtime shape. The gap is domain shape.

Today the platform is still fundamentally modeled around:

- `bankTenantId`
- `corporateTenantId`
- `corporateId`
- corporate-wide roles
- corporate-wide approval matrices
- a single effective product behavior

The package architecture LLD requires the platform to be modeled around:

- package catalog
- payment method catalog
- subscriptions
- subscription-scoped access
- subscription-scoped approval matrices
- overrides
- effective settings resolution

## 3. Repo-to-LLD Fit

### 3.1 What Already Fits

- The modular monolith architecture in `apps/api` is the right home for package, subscription, and resolver domains.
- The outbox plus worker pattern already supports subscription-aware projections, notifications, cache invalidation, and expiry jobs.
- The BFF is the right place to expose subscription-aware bootstrap responses and web navigation metadata.
- The current event-driven transaction model can carry subscription context once the core entities are upgraded.

### 3.2 What Does Not Fit Yet

- Payout contracts are corporate-scoped, not subscription-scoped.
- Approval matrices are currently keyed by `corporateTenantId`, not by subscription.
- Beneficiary behavior is still effectively vendor-oriented.
- Identity and access are corporate-wide, not subscription-specific.
- Tenant context currently carries bank and corporate fields only.
- There is no explicit product catalog, payment method catalog, override model, or debit-account model.

## 4. Current Module Impact

### 4.1 `tenant-management`

Current role:

- owns bank tenants, corporate tenants, and corporates

Expected future role:

- continues to own tenant hierarchy only
- becomes a dependency of subscription lifecycle, not the owner of package/subscription logic

Required change:

- minimal direct logic changes
- significant integration changes where downstream services stop treating tenant scope as the final operational scope

### 4.2 `identity-access`

Current role:

- corporate-wide users, roles, permissions, and login

Expected future role:

- user identity remains here
- access assignment becomes subscription-scoped
- effective permissions become subscription-aware

Required change:

- high

Risk:

- very high because it affects login, session shape, authorization, queues, and notifications

### 4.3 `beneficiary-management`

Current role:

- corporate beneficiary master with maker/checker approval

Expected future role:

- still a shared corporate master
- must support beneficiary types such as vendor, employee, and statutory
- must validate usage against package/subscription allowlists

Required change:

- medium to high

### 4.4 `approval-matrix-management`

Current role:

- approval matrices per corporate tenant

Expected future role:

- approval matrices per subscription
- immutable versions locked at submission time

Required change:

- high

### 4.5 `payout-management`

Current role:

- generic payout creation, upload, approval, dispatch, and read models

Expected future role:

- subscription-aware payment orchestration
- effective settings enforcement
- package-aware file handling
- payment method and debit account validation

Required change:

- very high

This is the most affected module in the repo.

### 4.6 `notifications`

Current role:

- corporate permission-based notifications

Expected future role:

- subscription-aware recipient resolution
- queue and action messages tied to subscription context

Required change:

- medium

### 4.7 `apps/bff`

Current role:

- login brokering
- bootstrap aggregation
- generic proxying for browser surfaces

Expected future role:

- subscription-aware workspace bootstrap
- active subscription resolution for web flows
- effective settings snapshot endpoints
- navigation metadata for corporate and bank-ops surfaces

Required change:

- medium

### 4.8 `apps/worker`

Current role:

- outbox publishing
- projection updates
- background dispatch and callback orchestration

Expected future role:

- carry `subscriptionId` and `packageCode` through projection and event handling
- invalidate effective settings cache
- process override expiry and renewal reminders

Required change:

- medium

## 5. New Domains Required

The current codebase does not yet have first-class ownership for these concepts:

- payment method catalog
- package catalog
- package-payment-method relationships
- subscriptions
- subscription overrides
- subscription preferences
- debit account management
- subscription-debit-account relationships
- subscription-user access
- effective settings resolver

Recommended new modules:

- `package-catalog`
- `subscription-management`
- `debit-account-management`
- `effective-settings-resolver`

These should live under `apps/api/src/modules`.

## 6. Cross-Cutting Architectural Decisions

The following decisions should be treated as locked implementation guidance for the repo:

### 6.1 Subscription becomes the operational unit

The current operational unit is effectively `corporateId`.

The future operational unit must be:

- `subscriptionId` internally
- `packageCode` externally

All major transaction-like entities should become subscription-aware.

### 6.2 Resolver becomes the single source of runtime truth

Rules must not remain scattered across `payout-management`, `beneficiary-management`, and approval-related services.

The platform needs one effective settings resolver that combines:

- package defaults
- active subscription
- active overrides
- subscription preferences
- payment-time choices

Every payment validation path should call this resolver.

### 6.3 External contracts should use `packageCode`

External clients should never be required to know `subscriptionId`.

Resolution flow should be:

- caller identity resolves corporate
- corporate plus `packageCode` resolves active subscription internally

### 6.4 Bulk files remain single-subscription

No mixed-subscription upload should be supported.

This aligns with approval, debit-account, and audit constraints already present in the platform.

## 7. Delivery Phases

### Phase 0: Migration Preparation

Goal:

- freeze the current v0 behavior as single-package prototype mode

Scope:

- document prototype assumptions
- map all corporate-scoped logic that must become subscription-aware
- lock domain vocabulary

Primary modules touched:

- docs only

Risk:

- low

### Phase 1: Product and Subscription Foundations

Goal:

- add the new product model without changing visible user behavior

Scope:

- package catalog domain
- payment method catalog domain
- subscription domain
- override domain
- preference domain
- debit account domain

Primary modules touched:

- `apps/api`
- DB migrations

Risk:

- medium

Exit criteria:

- the system can represent one hardcoded `VENPAY` subscription using the new model

### Phase 2: Effective Settings Resolver

Goal:

- centralize runtime rules in one resolver service

Scope:

- create `effective-settings-resolver`
- define effective settings assembly order
- expose internal service interface used by payouts and uploads

Primary modules touched:

- `apps/api`
- `apps/bff` for read endpoints when needed

Risk:

- medium

Exit criteria:

- package defaults, overrides, and preferences resolve in one place even if initial data is still minimal

### Phase 3: Subscription-Aware Identity and Navigation

Goal:

- make subscriptions visible in auth, session, and UI navigation

Scope:

- introduce subscription access assignments
- evolve session shape to include accessible subscriptions
- update BFF bootstrap to return subscription context
- update corporate web menus and active workspace model

Primary modules touched:

- `identity-access`
- `apps/bff`
- `apps/corporate-web`
- `apps/bank-ops-web`

Risk:

- high

Exit criteria:

- users can operate inside a subscription context even if only one real package exists initially

### Phase 4: Subscription-Scoped Approvals

Goal:

- move approval behavior from corporate scope to subscription scope

Scope:

- approval matrices keyed by subscription
- subscription-scoped approver roles
- approval queue and workflow updated to reflect subscription ownership
- submitted payments lock to matrix version

Primary modules touched:

- `approval-matrix-management`
- `identity-access`
- `notifications`
- worker projections

Risk:

- high

Exit criteria:

- AP-style and HR-style approval flows can differ cleanly

### Phase 5: Payout and Upload Migration

Goal:

- make the transaction engine subscription-aware

Scope:

- add `subscriptionId` to payouts, uploads, commands, and projections
- resolve `corporate + packageCode -> subscription`
- enforce single-subscription uploads
- apply resolver output in transaction validation

Primary modules touched:

- `payout-management`
- `apps/bff`
- `apps/corporate-web`
- worker projections

Risk:

- very high

Exit criteria:

- transaction and file flows are fully subscription-aware end to end

### Phase 6: Beneficiary Types and Debit Accounts

Goal:

- support package-specific beneficiary and debit-account constraints

Scope:

- add beneficiary types
- keep one corporate beneficiary master
- allow subscriptions to restrict which beneficiary types are valid
- add debit account master and subscription-account allowlists

Primary modules touched:

- `beneficiary-management`
- new debit-account module
- `payout-management`

Risk:

- medium to high

Exit criteria:

- Venpay, Salpay, and Taxpay can enforce different beneficiary and debit-account rules

### Phase 7: Bank Operations and Override Tooling

Goal:

- make the model operable for bank teams

Scope:

- package management UI
- subscription onboarding UI
- override create/revoke/expiry UI
- effective settings comparison screens

Primary modules touched:

- `apps/bank-ops-web`
- `apps/bff`
- package and subscription modules

Risk:

- medium

Exit criteria:

- bank admin and bank ops can manage the model without direct DB intervention

### Phase 8: Scale, Cache, and Operational Controls

Goal:

- harden the model for real production scale

Scope:

- resolver caching
- invalidation on package, override, and subscription change
- override expiry reports and jobs
- analytics and audit views

Primary modules touched:

- `apps/api`
- `apps/worker`
- observability and reporting surfaces

Risk:

- medium

Exit criteria:

- effective settings remain fast and auditable at scale

## 8. Recommended Execution Order

The minimum safe order is:

1. product and subscription model
2. effective settings resolver
3. subscription-aware auth and navigation
4. subscription-scoped approvals
5. payout and upload migration
6. beneficiary and debit-account enforcement
7. bank ops tooling
8. scale and operational hardening

This order is important because:

- payouts should not be migrated before the subscription model exists
- rules should not be spread further before the resolver exists
- approvals should not stay corporate-wide once transactions become subscription-aware

## 9. Prototype-to-v1 Migration Strategy

The current repo should be treated as a prototype-aligned implementation:

- one effective package behavior
- corporate-wide access
- no overrides
- one dominant beneficiary type
- one generic upload model

The migration should therefore be evolutionary:

- preserve current prototype flows while new foundations are introduced
- make single-subscription behavior the compatibility mode
- add new columns and relationships in backward-compatible steps
- only switch UI and validation logic to subscription-native mode after the resolver and access model exist

## 10. Immediate Next Engineering Chunks

The first concrete engineering slices should be:

1. create `package-catalog` module
2. create `subscription-management` module
3. create `effective-settings-resolver` module
4. add subscription-aware fields to transaction-facing contracts and internal entities in backward-compatible form
5. add BFF bootstrap support for active subscription context

These slices give the repo a forward-compatible spine without forcing a full UX migration on day one.

## 11. Summary

The locked package architecture LLD fits the current runtime architecture, but it does not fit the current domain model without substantial change.

The good news is that the repo already has the right deployment shape:

- web surfaces
- BFF
- modular monolith API
- event-driven worker path

The required transformation is therefore not a rewrite of the platform topology. It is a re-centering of the domain model around:

- packages
- subscriptions
- overrides
- effective settings

The key architectural move is to make `subscriptionId` the internal operational unit and to centralize business rule composition in an effective settings resolver.
