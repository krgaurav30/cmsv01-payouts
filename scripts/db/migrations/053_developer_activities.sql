create table if not exists partner_api_activities (
  activity_id text primary key,
  category text not null check (category in ('beneficiary', 'payment')),
  api_name text not null,
  method text not null,
  path text not null,
  request_headers jsonb not null default '{}'::jsonb,
  request_body jsonb,
  response_status integer not null,
  response_headers jsonb not null default '{}'::jsonb,
  response_body jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_api_activities_cat_time 
  on partner_api_activities (category, created_at desc);

alter table partner_webhook_deliveries 
  add column if not exists activity_id text references partner_api_activities(activity_id) on delete set null;

create index if not exists idx_partner_webhook_deliveries_activity_id 
  on partner_webhook_deliveries (activity_id);
