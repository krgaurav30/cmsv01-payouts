alter table beneficiaries
  add column if not exists approval_state text not null default 'approved';

alter table beneficiaries
  add column if not exists review_comment text null;

alter table corporate_roles
  add column if not exists approval_state text not null default 'approved';

alter table corporate_roles
  add column if not exists review_comment text null;

alter table corporate_users
  add column if not exists approval_state text not null default 'approved';

alter table corporate_users
  add column if not exists review_comment text null;

update beneficiaries
set approval_state = 'approved'
where approval_state is null;

update corporate_roles
set approval_state = 'approved'
where approval_state is null;

update corporate_users
set approval_state = 'approved'
where approval_state is null;

update corporate_roles
set name = 'checker',
    description = 'Can approve or reject maker requests across payouts, beneficiaries, roles, and users',
    permissions = array[
      'transaction.approve',
      'beneficiary.approve',
      'role.approve',
      'user.approve'
    ]
where lower(name) = 'approver';

update corporate_roles
set role_id = 'role-maya-checker'
where role_id = 'role-maya-approver'
  and not exists (
    select 1 from corporate_roles existing
    where existing.role_id = 'role-maya-checker'
  );

delete from corporate_roles
where role_id = 'role-maya-approver'
  and exists (
    select 1 from corporate_roles existing
    where existing.role_id = 'role-maya-checker'
  );

update corporate_users
set role = 'checker'
where lower(role) = 'approver';

update corporate_roles
set permissions = array[
  'transaction.create',
  'transaction.submit',
  'beneficiary.create',
  'role.create',
  'user.create'
]
where lower(name) = 'maker';

update corporate_roles
set permissions = array[
  'transaction.approve',
  'beneficiary.approve',
  'role.approve',
  'user.approve'
]
where lower(name) = 'checker';

update corporate_roles
set status = 'inactive',
    approval_state = 'rejected',
    review_comment = 'Retired because the workspace now supports only maker and checker roles'
where lower(name) not in ('maker', 'checker');

update corporate_users
set status = 'inactive',
    approval_state = 'rejected',
    review_comment = 'Retired because the workspace now supports only maker and checker roles'
where lower(role) not in ('maker', 'checker');

update beneficiaries
set approval_state = 'approved'
where approval_state not in ('approved', 'pending_approval', 'rejected');

update corporate_roles
set approval_state = 'approved'
where approval_state not in ('approved', 'pending_approval', 'rejected');

update corporate_users
set approval_state = 'approved'
where approval_state not in ('approved', 'pending_approval', 'rejected');
