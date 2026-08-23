/**
 * setup-admins.cjs
 * Ensures designated SUPER_ADMIN accounts have:
 *   - Correct role (SUPER_ADMIN) + password hash
 *   - AGENCY subscription that never expires (currentPeriodEnd = 2099-12-31)
 *   - Wallet with 10 M purchased credits (bypasses trial checks)
 *   - TrialGrant status = CONVERTED (never counted as trial user)
 *
 * Run once after first deploy, or re-run safely — all ops are upserts.
 *   node apps/api/scripts/setup-admins.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const ADMINS = [
  {
    email: 'sozialzync@gmail.com',
    role: 'SUPER_ADMIN',
    password: 'Admin@123',
    stripeKey: 'admin_sa_sozialzync',
  },
  {
    email: 'ethonanpasumvalki@gmail.com',
    role: 'SUPER_ADMIN',
    password: 'Creator@123',
    stripeKey: 'admin_sa_ethonanpasumvalki',
  },
  {
    email: 'moshaymuthukumar@gmail.com',
    role: 'SUPER_ADMIN',
    password: null,
    stripeKey: 'admin_sa_moshaymuthukumar',
  },
];

const AGENCY_EXPIRY = new Date('2099-12-31T23:59:59.000Z');
const ADMIN_CREDITS = 10_000_000;

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const admin of ADMINS) {
      console.log(`\n→ Setting up ${admin.role}: ${admin.email}`);

      // 1. Hash password if provided
      const passwordHash = admin.password ? await bcrypt.hash(admin.password, 12) : undefined;

      // 2. Upsert user record with role + password
      const user = await prisma.user.upsert({
        where:  { email: admin.email },
        update: {
          role: admin.role,
          ...(passwordHash ? { passwordHash } : {}),
          emailVerified: new Date(),
        },
        create: {
          email: admin.email,
          role: admin.role,
          emailVerified: new Date(),
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      console.log(`  ✓ User ${user.id} (${user.role})${passwordHash ? ' — password set' : ' — password unchanged'}`);

      // 3. Upsert AGENCY subscription — never expires
      const sub = await prisma.subscription.upsert({
        where:  { userId: user.id },
        update: {
          plan:              'AGENCY',
          status:            'ACTIVE',
          currentPeriodEnd:  AGENCY_EXPIRY,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId:             user.id,
          stripeCustomerId:   admin.stripeKey,
          plan:               'AGENCY',
          status:             'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd:   AGENCY_EXPIRY,
          cancelAtPeriodEnd:  false,
        },
      });
      console.log(`  ✓ Subscription ${sub.id} — AGENCY until 2099-12-31`);

      // 4. Upsert wallet with abundant purchased credits
      const wallet = await prisma.wallet.upsert({
        where:  { userId: user.id },
        update: {
          purchasedCredits:  ADMIN_CREDITS,
          balanceCredits:    ADMIN_CREDITS,
          lifetimePurchased: ADMIN_CREDITS,
        },
        create: {
          userId:            user.id,
          purchasedCredits:  ADMIN_CREDITS,
          balanceCredits:    ADMIN_CREDITS,
          lifetimePurchased: ADMIN_CREDITS,
        },
      });
      console.log(`  ✓ Wallet ${wallet.id} — ${ADMIN_CREDITS.toLocaleString()} credits`);

      // 5. Mark trial as CONVERTED so isTrialUser() is always false
      const now = new Date();
      const trialGrant = await prisma.trialGrant.upsert({
        where:  { userId: user.id },
        update: { status: 'CONVERTED' },
        create: {
          userId:         user.id,
          creditsGranted: 0,
          status:         'CONVERTED',
          expiresAt:      now,
          grantedAt:      now,
        },
      });
      console.log(`  ✓ TrialGrant ${trialGrant.id} — CONVERTED`);
    }

    console.log('\n✅ Admin setup complete.');
    console.log('\nAlso set these env vars on Railway (API service):');
    console.log('  SUPER_ADMIN_EMAILS=sozialzync@gmail.com,ethonanpasumvalki@gmail.com,moshaymuthukumar@gmail.com');
    console.log('\nThen redeploy: railway up\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
