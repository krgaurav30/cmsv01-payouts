alter table payout_batches
  add column if not exists subscription_id text references corporate_subscriptions(subscription_id) on delete set null,
  add column if not exists package_code text null;

alter table payout_file_uploads
  add column if not exists subscription_id text references corporate_subscriptions(subscription_id) on delete set null,
  add column if not exists package_code text null;

alter table payout_refunds
  add column if not exists subscription_id text references corporate_subscriptions(subscription_id) on delete set null,
  add column if not exists package_code text null;

alter table transaction_commands
  add column if not exists subscription_id text references corporate_subscriptions(subscription_id) on delete set null,
  add column if not exists package_code text null;

alter table transaction_list_projection
  add column if not exists subscription_id text null,
  add column if not exists package_code text null;

alter table approval_queue_projection
  add column if not exists subscription_id text null,
  add column if not exists package_code text null;

alter table file_upload_projection
  add column if not exists subscription_id text null,
  add column if not exists package_code text null;

create index if not exists idx_payout_batches_subscription_lookup
  on payout_batches (corporate_tenant_id, corporate_id, subscription_id, created_at desc);

create index if not exists idx_payout_file_uploads_subscription_lookup
  on payout_file_uploads (corporate_tenant_id, corporate_id, subscription_id, uploaded_at desc);

create index if not exists idx_transaction_commands_subscription_lookup
  on transaction_commands (corporate_tenant_id, corporate_id, subscription_id, received_at desc);

create index if not exists idx_transaction_list_projection_subscription_lookup
  on transaction_list_projection (corporate_tenant_id, corporate_id, subscription_id, created_at desc);

create index if not exists idx_approval_queue_projection_subscription_lookup
  on approval_queue_projection (corporate_tenant_id, corporate_id, subscription_id, updated_at desc);

create index if not exists idx_file_upload_projection_subscription_lookup
  on file_upload_projection (corporate_tenant_id, corporate_id, subscription_id, uploaded_at desc);
