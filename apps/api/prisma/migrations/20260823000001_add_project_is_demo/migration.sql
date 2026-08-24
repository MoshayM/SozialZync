-- AddColumn: isDemo to Project
-- Demo/advertisement projects: read-only for non-admins, seeded on app setup
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
