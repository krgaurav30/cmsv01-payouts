create table if not exists outbox_events (
  event_id text primary key,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  event_key text not null,
  version integer not null default 1,
  occurred_at timestamptz not null,
  payload_json jsonb not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text null,
  published_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_outbox_events_status_created
  on outbox_events (status, created_at);

create index if not exists idx_outbox_events_aggregate
  on outbox_events (aggregate_type, aggregate_id);
