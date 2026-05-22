# Entity Relationship Reference (Packages + Debit Account Architecture)

Date: 2026-05-22  
Scope: Corporate app + API + DB migration state in this repo

## Core Entities

1. `payment_methods`
- Bank-owned payment rail master (`IMPS`, `NEFT`, `RTGS`, `UPI`, etc.).
- Referenced by package definitions.

2. `packages`
- Product catalog entity.
- Supports `owner_type` (`bank` or `corporate`) via ownership-model migration.
- Stable external identifier: `package_code`.

3. `package_payment_methods`
- Junction table: `packages` ↔ `payment_methods`.
- Holds per-package method overrides where applicable.

4. `corporate_subscriptions`
- Corporate-to-package linkage.
- Contains subscription lifecycle (`active/suspended/terminated`).
- Carries `package_code` contract copy for runtime resolution.

5. `subscription_overrides`
- Per-subscription exceptions to package defaults.
- Auditable and time-bounded.

6. `corporate_subscription_preferences`
- Corporate-controlled preferences at subscription scope.

7. `corporate_debit_accounts`
- Corporate funding accounts (debit source accounts).

8. `subscription_debit_accounts`
- Junction table: `corporate_subscriptions` ↔ `corporate_debit_accounts`.
- Defines allowed funding accounts in subscription context.

9. `package_debit_accounts`
- Junction table: `packages` ↔ `corporate_debit_accounts`.
- Defines package-level allowed debit accounts and package-default account marker.

10. `role_debit_account_access`
- Junction table: `corporate_roles` ↔ `corporate_debit_accounts`.
- Global role-to-account permission map.

11. `approval_matrices`
- Approval rules, now package/subscription-aware.
- Includes debit-account scope (`debit_account_ids`).

12. `beneficiaries`
- Corporate beneficiary master.

13. `beneficiary_package_assignments`
- Junction table: `beneficiaries` ↔ `packages`.
- Enables package-level beneficiary eligibility.

14. `payout_batches`
- Transaction/batch aggregate.
- Scoped with `subscription_id`, `package_code`, `debit_account_id`, `payment_method_code`, `source_upload_id`.

15. `payout_items`
- Child payout items per batch.

16. `payout_file_uploads`
- Bulk file upload aggregate.
- Scoped with `subscription_id`, `package_code`, `debit_account_id`.

17. `transaction_commands`
- Command/event intake state with package/subscription/debit/payment fields.

18. Projections
- `transaction_list_projection`
- `approval_queue_projection`
- `file_upload_projection`
- All projection tables include package/subscription scope fields.

## Relationship Map

- `packages` -> `package_payment_methods` -> `payment_methods`
- `packages` -> `package_debit_accounts` -> `corporate_debit_accounts`
- `corporates` -> `corporate_subscriptions` -> `packages`
- `corporate_subscriptions` -> `subscription_debit_accounts` -> `corporate_debit_accounts`
- `corporate_roles` -> `role_debit_account_access` -> `corporate_debit_accounts`
- `beneficiaries` -> `beneficiary_package_assignments` -> `packages`
- `approval_matrices` references subscription context (+ debit account scopes)
- `payout_batches` references package/subscription/debit/payment context for execution

## Current Entity Audit Notes (Repo State)

1. DB migration layer includes required entities for package + debit-account architecture (`032` to `043` present).
2. Ownership model for packages is present (`036`).
3. Package default payment method + package debit account models are present (`035`, `041`).
4. Approval matrix debit-account scope is present (`040`, `041`).
5. Beneficiary-package linkage is present (`038`).
6. Runtime payout scoping with `subscription_id` and `package_code` is present (`033`, `042`, `043`).

## Follow-up Repair Checklist (Implementation Layer)

1. Restore consistent package create/edit UI against package-catalog schema.
2. Restore debit-account create/edit UI with full flow.
3. Rewire role-to-debit-account mapping UI + save API.
4. Rewire transaction form filters:
- selected package allowed accounts
- intersect with role allowed accounts
- prefill package default account
5. Rewire approval matrix create/edit to support account scopes.
6. Re-verify list/detail rendering on Transactions + Approvals.

## Package Entity Rules Update

Current package form/business rules:

1. `ownerType` is not required on the corporate-side create form.
- `bank` packages are created in the bank portal.
- `corporate` packages can be created in the corporate portal.
- `bank` packages can be imported on the corporate side.

2. Required package fields:
- `packageCode`
- `name`
- `useCase`
- `allowedBeneficiaryTypes`
- `paymentMethods` or `paymentMethodCodes` as the selectable method list
- `debitAccountIds`
- `defaultDebitAccountId`
- `defaultPaymentMethodCode`
- `debitModesAllowed`
- `fileRejectionModesAllowed`
- `maxPaymentsPerBatch`

3. Removed from the corporate-side package form:
- `ownerType`
- `basePackageCode`
- `status`
- `defaultDebitMode`
- `defaultFileRejectionMode`

4. Default selection rules:
- Default debit account must be selected from allowed debit accounts.
- Default payment method must be selected from allowed payment methods.
- Only `Allowed Debit Modes` and `Allowed File Failure Handling` remain as configurable mode groups.

## Beneficiary To Package Rule

- A beneficiary can be attached to one or more packages.
- A package can be linked to many beneficiaries.
- The beneficiary create/edit flow must capture `packageCodes`.
- Payment creation may only use a beneficiary that is assigned to the selected package.
- The beneficiary list should show assigned package codes for quick validation.

## Approval Matrix To Package And Debit Account Rule

- An approval matrix is scoped to a package subscription.
- An approval matrix must carry one or more debit accounts.
- The matrix creation UI must select the package subscription first, then the debit accounts.
- The backend validates that the selected debit accounts belong to the chosen subscription.
- The matrix roles must also be valid checker roles for that subscription.

## Subscription Formula

- `package` = what the bank sells as a product definition.
- `subscription` = that package applied to one corporate workspace, with its runtime rules and access.
- `debit account` = one of the funding accounts the subscription is allowed to use.
- `approval matrix` = the approval routing attached to the subscription and its allowed debit accounts.

One-line mental model:

- `subscription = package + corporate context + allowed debit accounts + access rules + approval rules`

Practical meaning:

- The package defines the product.
- The subscription turns that product into a live corporate setup.
- The debit accounts are part of the subscription’s allowed operating set.
- The approval matrix decides who approves payments inside that subscription.

## Payment Creation Rule

- The payment creator’s role determines which packages are visible at payment time.
- The selected package determines the allowed beneficiaries, debit accounts, and payment methods.
- The payment payload should carry the selected `packageCode`, `debitAccountId`, and `paymentMethodCode`.
- Bulk files must include `Package Code` as a required column so each row is validated against the selected package context.
