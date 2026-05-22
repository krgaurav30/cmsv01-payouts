alter table packages
  add column if not exists default_debit_account_id text null;

create table if not exists package_debit_accounts (
  package_id text not null references packages(package_id) on delete cascade,
  debit_account_id text not null references corporate_debit_accounts(debit_account_id) on delete cascade,
  status text not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (package_id, debit_account_id)
);

create unique index if not exists package_debit_accounts_default_idx
  on package_debit_accounts(package_id)
  where is_default = true and status = 'active';

create index if not exists package_debit_accounts_debit_account_idx
  on package_debit_accounts(debit_account_id);
