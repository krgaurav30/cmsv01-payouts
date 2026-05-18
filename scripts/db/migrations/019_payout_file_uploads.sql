create table if not exists payout_file_uploads (
  upload_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id),
  corporate_tenant_id text not null references corporate_tenants(tenant_id),
  corporate_id text references corporates(corporate_id),
  file_name text not null,
  uploaded_by_user_id text not null references corporate_users(user_id),
  uploaded_by_role text,
  status text not null check (status in ('successful', 'partially_successful', 'failed', 'rejected')),
  remark text,
  total_rows integer not null default 0,
  created_count integer not null default 0,
  rejected_count integer not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_payout_file_uploads_corporate_tenant
  on payout_file_uploads (corporate_tenant_id);

create index if not exists idx_payout_file_uploads_corporate
  on payout_file_uploads (corporate_id);

create index if not exists idx_payout_file_uploads_uploaded_at
  on payout_file_uploads (uploaded_at desc);
