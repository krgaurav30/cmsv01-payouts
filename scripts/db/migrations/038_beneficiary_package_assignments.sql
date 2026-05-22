create table if not exists beneficiary_package_assignments (
  beneficiary_id text not null references beneficiaries(beneficiary_id) on delete cascade,
  package_id text not null references packages(package_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (beneficiary_id, package_id)
);

insert into beneficiary_package_assignments (beneficiary_id, package_id)
select distinct b.beneficiary_id, cs.package_id
from beneficiaries b
join corporate_subscriptions cs
  on cs.corporate_id = b.corporate_id
where cs.status in ('active', 'draft', 'suspended')
on conflict (beneficiary_id, package_id) do nothing;

create index if not exists beneficiary_package_assignments_beneficiary_idx
  on beneficiary_package_assignments (beneficiary_id);

create index if not exists beneficiary_package_assignments_package_idx
  on beneficiary_package_assignments (package_id);

