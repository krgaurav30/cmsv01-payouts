-- Add optional metadata object to payout batches and transaction projections
ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
ALTER TABLE transaction_list_projection ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
