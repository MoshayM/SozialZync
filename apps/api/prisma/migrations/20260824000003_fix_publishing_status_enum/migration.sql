-- Fix: PublishingStatus was added as TEXT in 20260730000001 but Prisma
-- generates ::\"PublishingStatus\" casts which require a native PostgreSQL enum type.
-- This migration creates the enum and converts the column.

-- CreateEnum
CREATE TYPE "PublishingStatus" AS ENUM (
  'NOT_PUBLISHED',
  'DRAFT',
  'READY',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED'
);

-- AlterColumn: TEXT -> PublishingStatus enum (safe because all existing values match)
ALTER TABLE "projects"
  ALTER COLUMN "publishingStatus" TYPE "PublishingStatus"
  USING "publishingStatus"::"PublishingStatus";
