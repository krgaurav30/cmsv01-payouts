create table if not exists partner_webhooks (
  webhook_id text primary key,
  label text not null,
  webhook_url text not null,
  description text,
  event_types text[] not null default array[]::text[],
  status text not null check (status in ('active', 'inactive')) default 'active',
  signing_secret text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_delivery_status text check (last_delivery_status in ('successful', 'failed', 'pending')),
  last_delivery_http_status integer
);

create table if not exists partner_webhook_deliveries (
  delivery_id text primary key,
  webhook_id text not null references partner_webhooks(webhook_id) on delete cascade,
  event_type text not null,
  target_url text not null,
  payload jsonb,
  response_status integer,
  response_body text,
  status text not null check (status in ('pending', 'successful', 'failed')) default 'pending',
  attempted_at timestamptz not null default now()
);

create index if not exists idx_partner_webhooks_status
  on partner_webhooks (status, updated_at desc);

create index if not exists idx_partner_webhook_deliveries_webhook_id
  on partner_webhook_deliveries (webhook_id, attempted_at desc);
