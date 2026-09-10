-- AlterTable: add Stripe Connect fields to users for creator payout onboarding
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectAccountId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectEnabled" BOOLEAN NOT NULL DEFAULT false;
