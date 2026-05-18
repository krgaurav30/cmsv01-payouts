create table if not exists transaction_commands (
  command_id text primary key,
  channel text not null,
  bank_tenant_id text not null,
  corporate_tenant_id text not null,
  corporate_id text not null,
  actor_user_id text not null,
  transaction_reference text not null,
  payload_json jsonb not null,
  status text not null default 'accepted',
  batch_id text null,
  error_message text null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists idx_transaction_commands_status_received
  on transaction_commands (status, received_at);

create index if not exists idx_transaction_commands_corporate_lookup
  on transaction_commands (corporate_tenant_id, corporate_id, received_at desc);
