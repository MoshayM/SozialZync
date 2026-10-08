-- Add inline data buffer to asset_versions for ephemeral-disk resilience.
-- Files <= 8 MB are stored here so they survive Railway container restarts.
ALTER TABLE "asset_versions" ADD COLUMN "data" BYTEA;
