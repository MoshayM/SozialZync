-- Add scheduledAt to approvals (was in init schema but missing from production DB)
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
