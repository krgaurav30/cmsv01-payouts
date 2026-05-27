-- Immutable audit trail for RBI compliance.
-- Records every significant action across the system with before/after state,
-- actor identity, IP address, and user agent. This table should be treated as
-- append-only; no UPDATE or DELETE should be permitted in application code.

CREATE TABLE IF NOT EXISTS audit_trail (
  audit_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,          -- 'transaction', 'beneficiary', 'user', 'role', 'session'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,               -- 'create', 'approve', 'reject', 'update', 'login', 'login_failed', 'lockout'
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NULL,
  actor_ip_address TEXT NULL,
  actor_user_agent TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NULL,
  metadata JSONB NULL,                -- approval comment, reason, correlation ID, etc.
  corporate_tenant_id TEXT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity
  ON audit_trail (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_actor
  ON audit_trail (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant
  ON audit_trail (corporate_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action
  ON audit_trail (action, created_at DESC);
