create table if not exists corporate_users (
  user_id text primary key,
  username text not null unique,
  password text not null,
  display_name text not null,
  role text not null,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  corporate_id text null references corporates(corporate_id) on delete restrict,
  status text not null
);
