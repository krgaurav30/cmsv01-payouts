update corporate_roles
set permissions = array[
  'transaction.make',
  'beneficiary.make',
  'roles.make',
  'user.make',
  'devportal.view',
  'devportal.edit',
  'settings.view',
  'settings.edit'
]
where lower(name) = 'maker';

update corporate_roles
set permissions = array[
  'transaction.checker',
  'beneficiary.checker',
  'roles.checker',
  'user.checker',
  'devportal.view',
  'devportal.edit',
  'settings.view',
  'settings.edit'
]
where lower(name) = 'checker';
