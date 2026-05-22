alter table corporate_debit_accounts
  add column if not exists is_default boolean not null default false;

with ranked_accounts as (
  select debit_account_id,
         bank_tenant_id,
         corporate_tenant_id,
         corporate_id,
         row_number() over (
           partition by bank_tenant_id, corporate_tenant_id, corporate_id
           order by created_at asc, debit_account_id asc
         ) as account_rank
  from corporate_debit_accounts
  where status = 'active'
)
update corporate_debit_accounts cda
set is_default = ranked_accounts.account_rank = 1,
    updated_at = now()
from ranked_accounts
where ranked_accounts.debit_account_id = cda.debit_account_id
  and not exists (
    select 1
    from corporate_debit_accounts existing_default
    where existing_default.bank_tenant_id = ranked_accounts.bank_tenant_id
      and existing_default.corporate_tenant_id = ranked_accounts.corporate_tenant_id
      and existing_default.corporate_id = ranked_accounts.corporate_id
      and existing_default.is_default = true
  );

create unique index if not exists idx_corporate_debit_accounts_unique_default
  on corporate_debit_accounts (bank_tenant_id, corporate_tenant_id, corporate_id)
  where is_default = true;

create table if not exists role_debit_account_access (
  access_id text primary key,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete cascade,
  role_name text not null,
  debit_account_id text not null references corporate_debit_accounts(debit_account_id) on delete cascade,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_role_debit_account_access_unique_active
  on role_debit_account_access (corporate_tenant_id, role_name, debit_account_id)
  where status = 'active';
