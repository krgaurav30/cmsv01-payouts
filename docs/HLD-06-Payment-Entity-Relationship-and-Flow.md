# Payment Entity Relationship and Flow HLD

Date: 2026-05-23  
Scope: Package, payment method, debit account, role, beneficiary, approval matrix, subscription, and transaction flow

## 1. Purpose

This document defines the runtime entity model used by the corporate payments platform and how those entities interact during payment creation, approval, and bulk file upload.

The core rule is:

- `package` defines the product
- `subscription` applies that product to a corporate workspace
- `role` controls what a user can see and do
- `debit account` is the funding source
- `payment method` is the rail used for the payment
- `beneficiary` is the payee master record
- `approval matrix` defines who approves payments for the selected package and debit-account context

## 2. Core Entities

### 2.1 Payment Methods

Bank-defined rails such as `IMPS`, `NEFT`, `RTGS`, `UPI`, and `NACH`.

Responsibilities:

- define settlement behavior
- define min/max payment limits
- define cutoff time and weekend support
- serve as the selectable execution rail for packages

Key relationships:

- `packages` ↔ `payment_methods` through `package_payment_methods`

### 2.2 Packages

Commercial product definitions sold by the bank or created by the corporate for its own use.

Responsibilities:

- define payment use case
- define allowed beneficiary types
- define allowed payment methods
- define allowed debit accounts
- define allowed debit modes
- define allowed file failure handling
- define bulk approval behavior
- define package defaults

Stable external identifier:

- `package_code`

Key relationships:

- `packages` ↔ `payment_methods`
- `packages` ↔ `corporate_debit_accounts`
- `packages` ↔ `beneficiaries`
- `packages` → `corporate_subscriptions`

### 2.3 Subscriptions

An active package instance for a specific corporate workspace.

Responsibilities:

- bind a package to a corporate
- carry the runtime access rules for that corporate
- hold the subscription-level debit accounts
- hold subscription preferences
- act as the runtime bridge between package definition and transaction execution

Important mental model:

- `subscription = package + corporate context + allowed debit accounts + access rules + approval rules`

Key relationships:

- `corporates` → `corporate_subscriptions` → `packages`
- `corporate_subscriptions` ↔ `corporate_debit_accounts` through `subscription_debit_accounts`
- `corporate_subscriptions` ↔ `corporate_users` through `subscription_user_access`
- `corporate_subscriptions` ↔ `subscription_overrides`
- `corporate_subscriptions` ↔ `corporate_subscription_preferences`

### 2.4 Debit Accounts

Corporate funding accounts used to debit money from the corporate into beneficiary accounts.

Responsibilities:

- provide the funding source
- support corporate-level default debit account selection
- support package-level allowed debit account selection
- support role-level access control

Key relationships:

- `corporate_debit_accounts` ↔ `packages`
- `corporate_debit_accounts` ↔ `corporate_subscriptions`
- `corporate_debit_accounts` ↔ `corporate_roles` through `role_debit_account_access`

### 2.5 Roles

Corporate permission identities such as `maker` and `checker`.

Responsibilities:

- control which packages a user can access
- control which debit accounts a user can use
- control who can create, approve, and manage items in the workspace

Key relationships:

- `roles` → `subscription_user_access` → `corporate_subscriptions`
- `roles` → `role_debit_account_access` → `corporate_debit_accounts`
- `roles` → `approval_matrices` through matrix role selection

### 2.6 Beneficiaries

Corporate payees.

Responsibilities:

- store the beneficiary master record
- store Bene ID and bank details
- support package assignment
- restrict payment creation to allowed package(s)

Key relationships:

- `beneficiaries` ↔ `packages` through `beneficiary_package_assignments`

### 2.7 Approval Matrices

Rule sets that define who approves a payment for a given package and debit-account context.

Responsibilities:

- define approval levels
- define amount ranges
- define allowed roles
- define allowed debit accounts
- define a human-readable matrix name

Key relationships:

- `approval_matrices` references package subscription context
- `approval_matrices` ↔ `corporate_roles`
- `approval_matrices` ↔ `corporate_debit_accounts`

## 3. Relationship Map

- `packages` ↔ `payment_methods`
- `packages` ↔ `corporate_debit_accounts`
- `packages` ↔ `beneficiaries`
- `corporates` → `corporate_subscriptions` → `packages`
- `corporate_subscriptions` ↔ `corporate_debit_accounts`
- `corporate_subscriptions` ↔ `corporate_users`
- `corporate_roles` ↔ `corporate_debit_accounts`
- `beneficiaries` ↔ `packages`
- `approval_matrices` ↔ `corporate_roles`
- `approval_matrices` ↔ `corporate_debit_accounts`
- `payout_batches` references `subscription_id`, `package_code`, `debit_account_id`, `payment_method_code`
- `payout_file_uploads` references `subscription_id`, `package_code`, `debit_account_id`

## 4. Payment Creation Flow

### 4.1 Package selection

The payment creator’s role determines which packages are visible.

At payment creation:

- the user selects a package first
- the UI resolves the package to an active subscription if needed
- only packages accessible to the role are shown

### 4.2 Beneficiary filtering

Once the package is selected:

- the beneficiary list is filtered to beneficiaries assigned to that package
- the payment can only use an approved beneficiary assigned to the selected package

### 4.3 Debit account filtering

Once the package is selected:

- the package’s allowed debit accounts are loaded
- the role’s debit-account permissions are intersected with the package-allowed accounts
- the package default debit account is preselected when available

### 4.4 Payment method filtering

Once the package is selected:

- only payment methods attached to that package are shown
- the package default payment method is preselected when available

### 4.5 Submission payload

The payment payload must carry:

- `packageCode`
- `debitAccountId`
- `paymentMethodCode`
- `beneficiaryId`

The backend then validates:

- role permission
- package access
- beneficiary package assignment
- debit-account allowance
- payment-method allowance
- amount limits

## 5. Approval Flow

### 5.1 Matrix resolution

When a payment is submitted:

- the system resolves the active approval matrix for the selected package/subscription
- the matrix is matched by amount range
- the matrix returns the approval levels and the roles required at each level

### 5.2 Approval checks

At approval time, the checker must satisfy:

- approved checker role
- access to the relevant subscription
- access to the relevant debit account
- role membership in the current approval level

### 5.3 Approval progression

The payment moves through:

- `draft`
- `pending_approval`
- `partially_approved`
- `approved`
- `sent_to_bank`
- `paid` or `failed`

## 6. Bulk File Flow

### 6.1 Required context

Bulk files are single-package, single-subscription files.

Each row is validated against the file’s package context.

### 6.2 Required columns

- `Package Code`
- `Transaction Reference`
- `Beneficiary ID`
- `Amount`

### 6.3 Optional columns

- `Payment Method Code`
- `Debit Account Number`
- `Tag`
- `Remark`

### 6.4 Fallback rules

If a row does not provide:

- `Debit Account Number` → use the package default debit account
- `Payment Method Code` → use the package default payment method

If the package default is missing, the row is rejected.

## 7. UI Rules

### 7.1 Transaction UI

- package is chosen first
- beneficiary dropdown is package-filtered
- debit-account dropdown is package-filtered and role-filtered
- payment-method dropdown is package-filtered
- defaults are prefilled when available

### 7.2 Beneficiary UI

- Bene ID is required
- package assignment is required
- one beneficiary may belong to multiple packages

### 7.3 Package UI

- payment methods are multi-select
- debit accounts are multi-select
- one default payment method is chosen from allowed methods
- one default debit account is chosen from allowed debit accounts
- allowed debit mode is single select
- allowed file failure handling is single select

### 7.4 Approval Matrix UI

- matrix name is required
- package subscription is required
- debit accounts are selected for the matrix
- roles are multi-select dropdowns
- amount range is displayed together

## 8. Operational Notes

- Package codes are stable external identifiers.
- Subscription IDs are internal runtime identifiers.
- A corporate can have multiple active subscriptions, one per package.
- A role can have access to multiple subscriptions and multiple debit accounts.
- A beneficiary can belong to multiple packages.
- The approval matrix is package-aware and debit-account-aware.

## 9. Summary

The runtime flow is:

- `role` determines visible packages
- `package` determines visible beneficiaries, debit accounts, and payment methods
- `debit account` determines funding source and role access
- `beneficiary` determines who can be paid
- `approval matrix` determines who approves the payment
- `subscription` is the runtime bridge that makes the package real for a corporate

If the user wants to create a payment or upload a file, the system must validate the selected package context first and then derive all related payment constraints from that package.
