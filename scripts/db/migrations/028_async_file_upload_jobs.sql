alter table payout_file_uploads
  add column if not exists payload_json jsonb null,
  add column if not exists processing_started_at timestamptz null,
  add column if not exists processed_at timestamptz null;
