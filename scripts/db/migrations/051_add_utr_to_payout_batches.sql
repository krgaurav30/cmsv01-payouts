-- Migration 051: Add UTR and Narration columns
alter table payout_file_uploads add column if not exists utr text;
alter table payout_batches add column if not exists utr text;
alter table payout_batches add column if not exists narration text;
