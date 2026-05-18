create table if not exists corporate_tenant_settings (
  corporate_tenant_id text primary key references corporate_tenants(tenant_id) on delete cascade,
  company_display_name text not null,
  support_email text null,
  support_phone text null,
  registered_address text null,
  default_approval_note_template text null,
  max_single_transaction_amount numeric(18, 2) not null,
  max_daily_cumulative_transaction_amount numeric(18, 2) not null,
  max_bulk_upload_rows integer not null,
  duplicate_reference_policy text not null,
  updated_at timestamptz not null default now(),
  updated_by_user_id text null references corporate_users(user_id),
  updated_by_role text null
);

insert into corporate_tenant_settings (
  corporate_tenant_id,
  company_display_name,
  support_email,
  support_phone,
  registered_address,
  default_approval_note_template,
  max_single_transaction_amount,
  max_daily_cumulative_transaction_amount,
  max_bulk_upload_rows,
  duplicate_reference_policy,
  updated_at,
  updated_by_user_id,
  updated_by_role
)
select
  tenant_id,
  name,
  null,
  null,
  null,
  'Submitted by maker for checker approval',
  500000.00,
  5000000.00,
  100,
  'enabled',
  now(),
  null,
  null
from corporate_tenants
on conflict (corporate_tenant_id) do nothing;
