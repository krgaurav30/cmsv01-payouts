-- migration 054_add_api_ref_to_payout_batches.sql
alter table payout_batches add column if not exists api_ref_number text;
