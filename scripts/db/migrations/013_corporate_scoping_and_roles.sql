alter table beneficiaries
  add column if not exists corporate_id text null references corporates(corporate_id) on delete restrict;

alter table beneficiaries
  alter column category drop not null;

alter table beneficiaries
  alter column tags drop not null;

update beneficiaries
set tags = '{}'
where tags is null;

alter table payout_batches
  add column if not exists corporate_id text null references corporates(corporate_id) on delete restrict;

alter table payout_refunds
  add column if not exists corporate_id text null references corporates(corporate_id) on delete restrict;

create table if not exists corporate_roles (
  role_id text primary key,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  name text not null,
  description text null,
  status text not null,
  permissions text[] not null default '{}'
);
