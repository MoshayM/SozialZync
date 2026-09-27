-- Add shortClipId to edit_projects (idempotent)
ALTER TABLE "edit_projects" ADD COLUMN IF NOT EXISTS "shortClipId" TEXT;
