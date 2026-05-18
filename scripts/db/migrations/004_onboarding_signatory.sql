alter table onboarding_applications
  alter column cin drop not null;

alter table onboarding_applications
  add column if not exists signatory_name text;

update onboarding_applications
set signatory_name = coalesce(signatory_name, legal_entity_name)
where signatory_name is null;

alter table onboarding_applications
  alter column signatory_name set not null;
