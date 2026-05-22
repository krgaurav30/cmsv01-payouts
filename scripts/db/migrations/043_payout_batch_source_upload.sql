alter table payout_batches
  add column if not exists source_upload_id text null;

create index if not exists idx_payout_batches_source_upload_lookup
  on payout_batches (source_upload_id, state, created_at desc);
