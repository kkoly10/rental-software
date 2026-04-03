-- Add audit trail columns for document signing.
-- signer_ip and signer_user_agent provide forensic evidence if a signature
-- is disputed. These columns are write-once (set at signing time).
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS signer_ip text,
ADD COLUMN IF NOT EXISTS signer_user_agent text;
