create table if not exists payment_methods (
  payment_method_code text primary key,
  name text not null,
  rail_family text not null,
  settlement_mode text not null check (settlement_mode in ('real_time', 'batch')),
  weekend_support boolean not null default false,
  min_amount numeric(18, 2),
  max_amount numeric(18, 2),
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists packages (
  package_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id),
  package_code text not null unique,
  name text not null,
  use_case text not null,
  description text,
  allowed_beneficiary_types text[] not null default array[]::text[],
  bulk_approve_enabled boolean not null default false,
  debit_modes_allowed text[] not null default array['single']::text[],
  default_debit_mode text not null default 'single',
  file_rejection_modes_allowed text[] not null default array['fail_full_file']::text[],
  default_file_rejection_mode text not null default 'fail_full_file',
  max_payments_per_batch integer not null default 1000,
  pricing_defaults_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists package_payment_methods (
  package_id text not null references packages(package_id) on delete cascade,
  payment_method_code text not null references payment_methods(payment_method_code),
  min_amount_override numeric(18, 2),
  max_amount_override numeric(18, 2),
  pricing_overrides_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (package_id, payment_method_code)
);

create table if not exists corporate_subscriptions (
  subscription_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id),
  corporate_tenant_id text not null references corporate_tenants(tenant_id),
  corporate_id text not null references corporates(corporate_id),
  package_id text not null references packages(package_id),
  package_code text not null,
  display_name text not null,
  status text not null check (status in ('draft', 'active', 'suspended', 'terminated')) default 'draft',
  started_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_corporate_subscriptions_one_active_per_package
  on corporate_subscriptions (corporate_id, package_code)
  where status = 'active';

create table if not exists subscription_overrides (
  override_id text primary key,
  subscription_id text not null references corporate_subscriptions(subscription_id) on delete cascade,
  setting_key text not null,
  original_value_json jsonb,
  override_value_json jsonb not null,
  reason text not null,
  approved_by text not null,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  is_permanent boolean not null default false,
  status text not null check (status in ('active', 'revoked', 'expired')) default 'active',
  revoked_at timestamptz,
  revoked_by text,
  created_at timestamptz not null default now()
);

create table if not exists corporate_subscription_preferences (
  subscription_id text primary key references corporate_subscriptions(subscription_id) on delete cascade,
  preferred_debit_mode text,
  preferred_file_rejection_mode text,
  default_debit_account_id text,
  payment_method_preferences_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists corporate_debit_accounts (
  debit_account_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id),
  corporate_tenant_id text not null references corporate_tenants(tenant_id),
  corporate_id text not null references corporates(corporate_id),
  account_name text not null,
  account_number text not null,
  ifsc text not null,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscription_debit_accounts (
  subscription_id text not null references corporate_subscriptions(subscription_id) on delete cascade,
  debit_account_id text not null references corporate_debit_accounts(debit_account_id) on delete cascade,
  allowed_payment_method_codes text[] not null default array[]::text[],
  status text not null check (status in ('active', 'inactive')) default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (subscription_id, debit_account_id)
);

create table if not exists subscription_user_access (
  access_id text primary key,
  subscription_id text not null references corporate_subscriptions(subscription_id) on delete cascade,
  user_id text not null references corporate_users(user_id) on delete cascade,
  role_name text not null,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_subscription_user_access_unique_active
  on subscription_user_access (subscription_id, user_id, role_name)
  where status = 'active';

create index if not exists idx_packages_bank_tenant_status
  on packages (bank_tenant_id, status, package_code);

create index if not exists idx_corporate_subscriptions_corporate_status
  on corporate_subscriptions (corporate_id, status, package_code);

create index if not exists idx_subscription_overrides_subscription_status
  on subscription_overrides (subscription_id, status, effective_until);
