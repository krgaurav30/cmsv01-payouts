-- Account lockout columns for brute-force protection
-- After 5 consecutive failed login attempts, the account is locked for 30 minutes.

ALTER TABLE corporate_users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE corporate_users
  ADD COLUMN IF NOT EXISTS locked_until BIGINT NULL;

-- Index for efficient lockout checks during login
CREATE INDEX IF NOT EXISTS idx_corporate_users_username_lockout
  ON corporate_users (username, locked_until);
