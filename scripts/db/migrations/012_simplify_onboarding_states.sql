update onboarding_applications
set state = case
  when state in ('draft', 'under_review') then 'submitted'
  when state = 'info_requested' then 'sent_back'
  else state
end
where state in ('draft', 'under_review', 'info_requested');
