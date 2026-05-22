alter table approval_matrices
  add column if not exists debit_account_ids text[] not null default array[]::text[];

alter table payout_batches
  add column if not exists debit_account_id text null references corporate_debit_accounts(debit_account_id) on delete set null;

alter table payout_file_uploads
  add column if not exists debit_account_id text null references corporate_debit_accounts(debit_account_id) on delete set null;

alter table transaction_commands
  add column if not exists debit_account_id text null references corporate_debit_accounts(debit_account_id) on delete set null;

alter table file_upload_projection
  add column if not exists debit_account_id text null;

create index if not exists idx_approval_matrices_subscription_accounts
  on approval_matrices (subscription_id, status, amount_from, amount_to);

create index if not exists idx_payout_batches_debit_account_lookup
  on payout_batches (corporate_tenant_id, corporate_id, debit_account_id, created_at desc);
