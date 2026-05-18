alter table payout_batches
  add column if not exists tag text null;

alter table payout_batches
  add column if not exists remark text null;

alter table payout_batches
  add column if not exists created_at timestamptz not null default now();

alter table payout_batches
  add column if not exists created_by_role text null;

alter table payout_batches
  add column if not exists submitted_at timestamptz null;

alter table payout_batches
  add column if not exists submitted_by_user_id text null;

alter table payout_batches
  add column if not exists submitted_by_role text null;

alter table payout_batches
  add column if not exists approved_at timestamptz null;

alter table payout_batches
  add column if not exists approved_by_user_id text null;

alter table payout_batches
  add column if not exists approved_by_role text null;

alter table payout_batches
  add column if not exists rejected_at timestamptz null;

alter table payout_batches
  add column if not exists rejected_by_user_id text null;

alter table payout_batches
  add column if not exists rejected_by_role text null;

update payout_batches
set created_at = now()
where created_at is null;
