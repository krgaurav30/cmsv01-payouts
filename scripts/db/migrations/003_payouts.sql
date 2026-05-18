create table if not exists payout_batches (
  batch_id text primary key,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  created_by_user_id text not null,
  title text not null,
  state text not null,
  total_amount numeric(18,2) not null,
  approval_comment text null
);

create table if not exists payout_items (
  item_id text primary key,
  batch_id text not null references payout_batches(batch_id) on delete cascade,
  beneficiary_id text not null references beneficiaries(beneficiary_id) on delete restrict,
  amount numeric(18,2) not null,
  currency text not null,
  purpose text not null
);
