'use strict';
/**
 * Bootstrap admin account — sets email + password + SUPER_ADMIN role directly in the DB.
 * Run on Railway: node apps/api/scripts/set-admin.cjs
 * Required env vars:  ADMIN_EMAIL  ADMIN_PASSWORD  DATABASE_URL
 *
 * Safe to run multiple times — updates existing account if found, creates new one if not.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const EMAIL    = (process.env.ADMIN_EMAIL    || '').trim().toLowerCase();
const PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.');
  process.exit(1);
}
if (PASSWORD.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, role: 'SUPER_ADMIN', emailVerified: new Date() },
      select: { id: true, email: true, role: true },
    });
    console.log('Updated existing user → SUPER_ADMIN:', user);
  } else {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        name: EMAIL.split('@')[0],
        passwordHash: hash,
        role: 'SUPER_ADMIN',
        emailVerified: new Date(),
      },
      select: { id: true, email: true, role: true },
    });
    console.log('Created new SUPER_ADMIN account:', user);
  }

  console.log('\nDone. You can now log in at /login with:');
  console.log('  Email:   ', EMAIL);
  console.log('  Password: (the value you set in ADMIN_PASSWORD)');
  console.log('\nIMPORTANT: Also set SUPER_ADMIN_EMAILS=' + EMAIL + ' on Railway.');
  console.log('Without that env var, the role will be demoted back to OWNER on next login.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
