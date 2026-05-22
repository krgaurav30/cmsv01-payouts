delete from subscription_user_access sua
using (
  select
    s.subscription_id,
    u.user_id,
    u.role
  from corporate_subscriptions s
  join corporate_users u
    on u.corporate_tenant_id = s.corporate_tenant_id
   and u.corporate_id = s.corporate_id
  where s.status = 'active'
    and u.status = 'active'
    and coalesce(u.approval_state, 'approved') = 'approved'
    and u.role in ('maker', 'checker')
) existing_rows
where sua.subscription_id = existing_rows.subscription_id
  and sua.user_id = existing_rows.user_id
  and sua.role_name = existing_rows.role
  and sua.status = 'active';

insert into subscription_user_access (
  access_id,
  subscription_id,
  user_id,
  role_name,
  status,
  created_at,
  updated_at
)
select
  concat(
    'sua-',
    s.subscription_id,
    '-',
    regexp_replace(lower(u.user_id), '[^a-z0-9]+', '-', 'g'),
    '-',
    lower(u.role)
  ) as access_id,
  s.subscription_id,
  u.user_id,
  u.role,
  'active',
  now(),
  now()
from corporate_subscriptions s
join corporate_users u
  on u.corporate_tenant_id = s.corporate_tenant_id
 and u.corporate_id = s.corporate_id
where s.status = 'active'
  and u.status = 'active'
  and coalesce(u.approval_state, 'approved') = 'approved'
  and u.role in ('maker', 'checker')
  and not exists (
    select 1
    from subscription_user_access existing
    where existing.subscription_id = s.subscription_id
      and existing.user_id = u.user_id
      and existing.role_name = u.role
      and existing.status = 'active'
  );
