alter table corporate_users
  add column if not exists created_by_user_id text null references corporate_users(user_id),
  add column if not exists created_by_role text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by_user_id text null references corporate_users(user_id),
  add column if not exists reviewed_by_role text null;

alter table corporate_roles
  add column if not exists created_by_user_id text null references corporate_users(user_id),
  add column if not exists created_by_role text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by_user_id text null references corporate_users(user_id),
  add column if not exists reviewed_by_role text null;
