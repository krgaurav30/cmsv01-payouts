create table if not exists corporates (
  corporate_id text primary key,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  name text not null,
  legal_entity_name text not null,
  corporate_admin_email text not null,
  status text not null
);

alter table onboarding_applications
  add column if not exists corporate_tenant_name text null;

update onboarding_applications
set onboarding_mode = 'new_corporate_under_existing_tenant'
where onboarding_mode = 'existing_corporate_tenant';

insert into corporates (
  corporate_id, corporate_tenant_id, bank_tenant_id, name, legal_entity_name, corporate_admin_email, status
)
select
  tenant_id || '-corp-001',
  tenant_id,
  bank_tenant_id,
  name,
  legal_entity_name,
  corporate_admin_email,
  'active'
from corporate_tenants
on conflict (corporate_id) do nothing;
