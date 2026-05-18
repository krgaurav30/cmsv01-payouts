alter table onboarding_applications
  alter column gstin drop not null;

alter table onboarding_applications
  add column if not exists onboarding_mode text;

update onboarding_applications
set onboarding_mode = coalesce(onboarding_mode, 'existing_corporate_tenant')
where onboarding_mode is null;

alter table onboarding_applications
  alter column onboarding_mode set not null;
