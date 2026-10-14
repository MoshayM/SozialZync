-- Add inline data buffer to asset_versions for ephemeral-disk resilience.
-- Files <= 50 MB are stored here so they survive Railway container restarts.
-- IF NOT EXISTS: safe to replay when the column was created via db push earlier.
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "data" BYTEA;
