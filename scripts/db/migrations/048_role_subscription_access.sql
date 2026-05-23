-- Create role_subscription_access table
create table if not exists role_subscription_access (
  access_id text primary key,
  corporate_tenant_id text not null references corporate_tenants(tenant_id),
  role_name text not null,
  subscription_id text not null references corporate_subscriptions(subscription_id) on delete cascade,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_role_subscription_access_unique_active
  on role_subscription_access (corporate_tenant_id, role_name, subscription_id)
  where status = 'active';

-- Populate existing mappings from subscription_user_access
insert into role_subscription_access (
  access_id,
  corporate_tenant_id,
  role_name,
  subscription_id,
  status,
  created_at,
  updated_at
)
select distinct
  concat('rsa-', s.corporate_tenant_id, '-', lower(sua.role_name), '-', sua.subscription_id) as access_id,
  s.corporate_tenant_id,
  sua.role_name,
  sua.subscription_id,
  'active',
  now(),
  now()
from subscription_user_access sua
join corporate_subscriptions s on s.subscription_id = sua.subscription_id
where sua.status = 'active'
on conflict (access_id) do nothing;
