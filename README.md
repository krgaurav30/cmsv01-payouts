# CMS Banking Platform

Initial scaffold for the bank-embedded payouts platform prototype.

## Current slice

This repository currently includes only the foundation slice:

- API application shell
- worker shell
- shared config and tenant context utilities
- health endpoints
- Kafka bootstrap placeholder
- initial identity-access and database wiring
- initial tenant-management module
- initial corporate-onboarding workflow
- initial beneficiary-management workflow
- initial payout and approval workflow

## Next slices

1. identity and access
2. tenant management
3. corporate onboarding

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies
3. Run database migrations with `npm run db:migrate`
4. Optionally load seed data with `npm run db:seed`
5. Start the API with `npm run dev:api`
6. Start the worker with `npm run dev:worker`

## Database workflow

- SQL migrations live in [scripts/db/migrations](C:\Users\krgau\OneDrive\Documents\Projects\CMSV01\scripts\db\migrations)
- migration runner: `npm run db:migrate`
- seed runner: `npm run db:seed`

## API endpoints today

- `GET /health`
- `GET /context`
- `GET /v1/auth/health`
- `GET /v1/auth/roles`
- `POST /v1/auth/login`
- `GET /v1/tenants/health`
- `GET /v1/tenants/banks`
- `GET /v1/tenants/banks/:tenantId`
- `POST /v1/tenants/banks`
- `GET /v1/tenants/corporates`
- `GET /v1/tenants/corporates/:tenantId`
- `POST /v1/tenants/corporates`
- `GET /v1/onboarding/health`
- `GET /v1/onboarding/applications`
- `GET /v1/onboarding/applications/:applicationId`
- `POST /v1/onboarding/applications`
- `POST /v1/onboarding/applications/:applicationId/actions`
- `GET /v1/beneficiaries/health`
- `GET /v1/beneficiaries`
- `GET /v1/beneficiaries/:beneficiaryId`
- `POST /v1/beneficiaries`
- `PUT /v1/beneficiaries/:beneficiaryId`
- `DELETE /v1/beneficiaries/:beneficiaryId`
- `GET /v1/payouts/health`
- `GET /v1/payouts/batches`
- `GET /v1/payouts/batches/:batchId`
- `POST /v1/payouts/batches`
- `POST /v1/payouts/batches/:batchId/actions`
- `GET /corporate/onboarding`
- `GET /ui`
