-- Create processed_events table for consumer idempotency
create table if not exists processed_events (
  event_id varchar(255) primary key,
  processed_at timestamptz not null default now()
);
