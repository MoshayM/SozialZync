// One-time script: marks the failed 20260915000001 migration as applied
// so prisma migrate deploy can proceed. Safe to run repeatedly.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "_prisma_migrations"
     SET finished_at = NOW(), applied_steps_count = 1, logs = NULL, rolled_back_at = NULL
     WHERE migration_name = '20260915000001_add_platform_watch_readonly'
       AND (finished_at IS NULL OR rolled_back_at IS NOT NULL)`
  );
  console.log(`[pre-start] Fixed migration record (rows updated: ${result})`);
} catch (e) {
  // Non-fatal — if the record is already correct, migrate deploy will work fine
  console.error('[pre-start] Migration fix skipped:', e.message);
} finally {
  await prisma.$disconnect();
}
