-- Add source field to shorts_thumbnails (tracks FRAME_EXTRACT / AI_GENERATED / CUSTOM_UPLOAD)
ALTER TABLE "shorts_thumbnails" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'FRAME_EXTRACT';

-- Add description, language, tags to edit_projects for Save to Private metadata persistence
ALTER TABLE "edit_projects" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "edit_projects" ADD COLUMN IF NOT EXISTS "language"    TEXT;
ALTER TABLE "edit_projects" ADD COLUMN IF NOT EXISTS "tags"        TEXT[] NOT NULL DEFAULT '{}';
