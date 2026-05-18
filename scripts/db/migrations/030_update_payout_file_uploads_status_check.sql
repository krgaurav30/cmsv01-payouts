ALTER TABLE payout_file_uploads
DROP CONSTRAINT payout_file_uploads_status_check;

ALTER TABLE payout_file_uploads
ADD CONSTRAINT payout_file_uploads_status_check
CHECK (status in ('processing', 'successful', 'partially_successful', 'failed', 'rejected'));
