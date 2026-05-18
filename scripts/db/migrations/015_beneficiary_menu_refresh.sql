alter table beneficiaries
  add column if not exists phone_number text null;

alter table beneficiaries
  add column if not exists status text not null default 'active';

alter table beneficiaries
  add column if not exists created_at timestamptz not null default now();

alter table beneficiaries
  add column if not exists updated_at timestamptz not null default now();

alter table beneficiaries
  alter column pan drop not null;

alter table beneficiaries
  alter column type set default 'vendor';

update beneficiaries
set status = case
  when approval_state = 'approved' then 'active'
  else 'inactive'
end
where status not in ('active', 'inactive');

update beneficiaries
set updated_at = now()
where updated_at is null;

create unique index if not exists beneficiaries_corporate_name_account_unique
  on beneficiaries (corporate_id, lower(name), account_number);
