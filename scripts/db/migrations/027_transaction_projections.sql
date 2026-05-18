create table if not exists transaction_approval_assignments (
  assignment_id text primary key,
  batch_id text not null,
  corporate_tenant_id text not null,
  corporate_id text null,
  approval_level integer not null,
  role_name text not null,
  status text not null default 'pending',
  acted_by_user_id text null,
  acted_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (batch_id, approval_level, role_name)
);

create index if not exists idx_transaction_approval_assignments_queue
  on transaction_approval_assignments (corporate_tenant_id, status, approval_level);

create table if not exists transaction_list_projection (
  batch_id text primary key,
  bank_tenant_id text not null,
  corporate_tenant_id text not null,
  corporate_id text null,
  primary_beneficiary_id text null,
  primary_beneficiary_name text null,
  created_by_user_id text not null,
  created_by_role text null,
  title text not null,
  tag text null,
  remark text null,
  state text not null,
  total_amount numeric(18,2) not null,
  approval_comment text null,
  bank_reference text null,
  dispatched_at timestamptz null,
  completed_at timestamptz null,
  failure_reason text null,
  approval_levels_required integer null,
  current_approval_level integer null,
  roles_by_level jsonb null,
  matched_matrix_ids text[] null,
  created_at timestamptz null,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  submitted_by_user_id text null,
  submitted_by_role text null,
  approved_by_user_id text null,
  approved_by_role text null,
  rejected_by_user_id text null,
  rejected_by_role text null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_transaction_list_projection_lookup
  on transaction_list_projection (corporate_tenant_id, corporate_id, state, created_at desc);

create table if not exists approval_queue_projection (
  queue_id text primary key,
  batch_id text not null unique,
  corporate_tenant_id text not null,
  corporate_id text null,
  title text not null,
  state text not null,
  approval_level integer null,
  approval_levels_required integer null,
  approval_roles jsonb not null default '[]'::jsonb,
  total_amount numeric(18,2) not null,
  created_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_approval_queue_projection_lookup
  on approval_queue_projection (corporate_tenant_id, corporate_id, state, updated_at desc);

create table if not exists file_upload_projection (
  upload_id text primary key,
  bank_tenant_id text not null,
  corporate_tenant_id text not null,
  corporate_id text null,
  file_name text not null,
  uploaded_by_user_id text not null,
  uploaded_by_role text null,
  status text not null,
  remark text null,
  total_rows integer not null,
  created_count integer not null,
  rejected_count integer not null,
  uploaded_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_file_upload_projection_lookup
  on file_upload_projection (corporate_tenant_id, corporate_id, uploaded_at desc);
