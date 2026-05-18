create table if not exists beneficiaries (
  beneficiary_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  name text not null,
  account_number text not null,
  ifsc text not null,
  type text not null,
  pan text not null,
  gstin text null,
  category text not null,
  tags text[] not null default '{}'
);
