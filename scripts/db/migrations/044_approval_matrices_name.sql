alter table approval_matrices
  add column if not exists name text null;

update approval_matrices
set name = coalesce(name, matrix_id)
where name is null;

alter table approval_matrices
  alter column name set not null;

create index if not exists approval_matrices_name_idx
  on approval_matrices (corporate_tenant_id, name);
