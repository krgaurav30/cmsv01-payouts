alter table payout_batches
  add column if not exists payment_method_code text null references payment_methods(payment_method_code);

alter table transaction_commands
  add column if not exists payment_method_code text null references payment_methods(payment_method_code);

create index if not exists idx_payout_batches_payment_method_lookup
  on payout_batches (corporate_tenant_id, corporate_id, payment_method_code, created_at desc);
