-- Add drawn signature storage to the documents table.
-- The signature_data_url stores a base64 PNG data URL captured via the portal
-- signature canvas; it is embedded in the generated document PDF.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;
