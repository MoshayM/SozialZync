-- Add cost_usd column to asset_versions for provider cost tracking
ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;
