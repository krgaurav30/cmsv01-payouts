delete from role_debit_account_access rdaa
using (
  select
    a.corporate_tenant_id,
    r.role,
    a.debit_account_id
  from corporate_debit_accounts a
  join corporate_users r
    on r.corporate_tenant_id = a.corporate_tenant_id
   and r.corporate_id = a.corporate_id
  where a.status = 'active'
    and r.status = 'active'
    and coalesce(r.approval_state, 'approved') = 'approved'
    and r.role in ('maker', 'checker')
) existing_rows
where rdaa.corporate_tenant_id = existing_rows.corporate_tenant_id
  and rdaa.role_name = existing_rows.role
  and rdaa.debit_account_id = existing_rows.debit_account_id
  and rdaa.status = 'active';

insert into role_debit_account_access (
  access_id,
  corporate_tenant_id,
  role_name,
  debit_account_id,
  status,
  created_at,
  updated_at
)
select
  concat(
    'rdaa-',
    a.corporate_tenant_id,
    '-',
    regexp_replace(lower(r.role), '[^a-z0-9]+', '-', 'g'),
    '-',
    a.debit_account_id
  ) as access_id,
  a.corporate_tenant_id,
  r.role,
  a.debit_account_id,
  'active',
  now(),
  now()
from corporate_debit_accounts a
join corporate_users r
  on r.corporate_tenant_id = a.corporate_tenant_id
 and r.corporate_id = a.corporate_id
where a.status = 'active'
  and r.status = 'active'
  and coalesce(r.approval_state, 'approved') = 'approved'
  and r.role in ('maker', 'checker')
  and not exists (
    select 1
    from role_debit_account_access existing
    where existing.corporate_tenant_id = a.corporate_tenant_id
      and existing.role_name = r.role
      and existing.debit_account_id = a.debit_account_id
      and existing.status = 'active'
  );
