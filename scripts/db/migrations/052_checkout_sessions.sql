CREATE TABLE checkout_sessions (
  checkout_session_id VARCHAR(128) PRIMARY KEY,
  bank_tenant_id VARCHAR(64) NOT NULL,
  corporate_tenant_id VARCHAR(64) NOT NULL,
  corporate_id VARCHAR(64) NOT NULL,
  transaction_reference VARCHAR(256) NOT NULL,
  amount_value NUMERIC(18, 2) NOT NULL,
  amount_currency VARCHAR(10) NOT NULL,
  package_code VARCHAR(64),
  beneficiary_id VARCHAR(64) NOT NULL,
  payment_method_code VARCHAR(64),
  redirect_url VARCHAR(1024),
  cancel_url VARCHAR(1024),
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB
);
