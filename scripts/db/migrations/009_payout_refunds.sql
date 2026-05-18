create table if not exists payout_refunds (
  refund_id text primary key,
  batch_id text not null references payout_batches(batch_id) on delete restrict,
  bank_tenant_id text not null references bank_tenants(tenant_id) on delete restrict,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete restrict,
  requested_by_user_id text not null,
  amount numeric(18,2) not null,
  reason text not null,
  state text not null,
  created_at timestamptz null,
  processed_at timestamptz null
);
