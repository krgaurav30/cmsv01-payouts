alter table payment_methods
  add column if not exists cutoff_time text not null default '18:00';
