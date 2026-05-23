alter table approval_matrices
  add column if not exists subscription_ids text[] not null default array[]::text[];

-- Migrate any existing subscription_id data
update approval_matrices
  set subscription_ids = array[subscription_id]
  where subscription_id is not null
    and (subscription_ids is null or cardinality(subscription_ids) = 0);

-- Drop the old subscription_id column and constraints
alter table approval_matrices
  drop column if exists subscription_id;

-- Drop obsolete indexes
drop index if exists approval_matrices_subscription_idx;
drop index if exists idx_approval_matrices_subscription_accounts;

-- Create GIN index for arrays search
create index if not exists approval_matrices_subscription_ids_idx
  on approval_matrices using gin (subscription_ids);
