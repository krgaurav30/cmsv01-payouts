update corporate_tenant_settings
set duplicate_reference_policy = 'enabled'
where duplicate_reference_policy is null
   or duplicate_reference_policy = ''
   or duplicate_reference_policy = 'reject_duplicate_reference';
