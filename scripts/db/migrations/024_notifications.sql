create table if not exists notifications (
  notification_id text primary key,
  corporate_tenant_id text not null,
  corporate_id text null,
  recipient_user_id text not null,
  title text not null,
  message text not null,
  target_section text not null,
  entity_type text null,
  entity_id text null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
  on notifications (recipient_user_id, created_at desc);

create index if not exists idx_notifications_recipient_unread
  on notifications (recipient_user_id, read_at, created_at desc);
