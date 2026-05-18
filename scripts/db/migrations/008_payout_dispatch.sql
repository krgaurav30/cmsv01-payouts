alter table payout_batches
  add column if not exists bank_reference text null,
  add column if not exists dispatched_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists failure_reason text null;

alter table payout_items
  add column if not exists state text not null default 'pending',
  add column if not exists bank_reference text null,
  add column if not exists failure_reason text null,
  add column if not exists processed_at timestamptz null;

update payout_items
set state = 'pending'
where state is null;
