create table if not exists partner_api_keys (
  key_id text primary key,
  label text not null,
  product_scope text not null default 'all',
  api_key text not null unique,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_partner_api_keys_status
  on partner_api_keys (status, created_at desc);
