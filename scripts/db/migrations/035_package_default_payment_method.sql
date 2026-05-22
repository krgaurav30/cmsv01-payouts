alter table packages
  add column if not exists default_payment_method_code text references payment_methods(payment_method_code);

create index if not exists idx_packages_default_payment_method
  on packages (default_payment_method_code);
