alter table packages
  add column if not exists owner_type text not null default 'bank'
    check (owner_type in ('bank', 'corporate')),
  add column if not exists corporate_tenant_id text references corporate_tenants(tenant_id),
  add column if not exists corporate_id text references corporates(corporate_id),
  add column if not exists base_package_code text;

update packages
set owner_type = 'bank'
where owner_type is null;

alter table packages
  drop constraint if exists packages_package_code_key;

create unique index if not exists idx_packages_bank_owner_unique
  on packages (bank_tenant_id, package_code)
  where owner_type = 'bank';

create unique index if not exists idx_packages_corporate_owner_unique
  on packages (corporate_id, package_code)
  where owner_type = 'corporate';

create index if not exists idx_packages_owner_scope
  on packages (owner_type, bank_tenant_id, corporate_tenant_id, corporate_id, status);
