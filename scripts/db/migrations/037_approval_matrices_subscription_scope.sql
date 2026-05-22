alter table approval_matrices
  add column if not exists subscription_id text null references corporate_subscriptions(subscription_id) on delete cascade;

create index if not exists approval_matrices_subscription_idx
  on approval_matrices (subscription_id, status, amount_from, amount_to);

