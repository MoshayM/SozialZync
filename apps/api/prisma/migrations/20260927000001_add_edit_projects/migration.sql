-- CreateTable (idempotent — table may exist from a partial prior attempt)
CREATE TABLE IF NOT EXISTS "edit_projects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "timeline" JSONB NOT NULL DEFAULT '{}',
    "renderAssetId" TEXT,
    "renderStatus" TEXT NOT NULL DEFAULT 'NONE',
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edit_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "edit_projects_projectId_idx" ON "edit_projects"("projectId");

-- AddForeignKey (idempotent via existence check)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'edit_projects_projectId_fkey'
    ) THEN
        ALTER TABLE "edit_projects" ADD CONSTRAINT "edit_projects_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
