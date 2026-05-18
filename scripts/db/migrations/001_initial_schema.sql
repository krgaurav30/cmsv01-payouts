create table if not exists bank_tenants (
  tenant_id text primary key,
  name text not null,
  subdomain text not null,
  primary_color text not null,
  contact_email text not null,
  status text not null
);

create table if not exists corporate_tenants (
  tenant_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  name text not null,
  legal_entity_name text not null,
  corporate_admin_email text not null,
  status text not null
);

create table if not exists onboarding_applications (
  application_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  legal_entity_name text not null,
  gstin text not null,
  pan text not null,
  cin text not null,
  registered_address text not null,
  primary_corporate_admin_email text not null,
  state text not null,
  review_comment text null
);
