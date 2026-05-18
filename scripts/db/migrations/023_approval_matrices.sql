create table if not exists approval_matrices (
  matrix_id text primary key,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete cascade,
  entity_type text not null default 'transaction',
  amount_from numeric(18, 2) not null,
  amount_to numeric(18, 2) not null,
  approval_levels integer not null,
  roles text[] not null,
  status text not null default 'active',
  created_by_user_id text null references corporate_users(user_id),
  created_by_role text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payout_batch_approval_contexts (
  batch_id text primary key references payout_batches(batch_id) on delete cascade,
  corporate_tenant_id text not null references corporate_tenants(tenant_id) on delete cascade,
  entity_type text not null default 'transaction',
  approval_levels_required integer not null,
  current_approval_level integer not null,
  roles_by_level jsonb not null,
  matched_matrix_ids text[] not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payout_batch_approval_actions (
  action_id text primary key,
  batch_id text not null references payout_batches(batch_id) on delete cascade,
  approval_level integer not null,
  action text not null,
  actor_user_id text not null references corporate_users(user_id),
  actor_role text not null,
  comment text null,
  created_at timestamptz not null default now()
);
