'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const EMAIL = process.env.CHECK_EMAIL || 'ethonanpasumvalki@gmail.com';

async function main() {
  const user = await p.user.findFirst({
    where: { email: { equals: EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });
  if (!user) { console.log('User not found:', EMAIL); return; }
  console.log(`User: ${user.email} (${user.role})`);

  const wallet = await p.wallet.findUnique({
    where: { userId: user.id },
    select: { balanceCredits: true, purchasedCredits: true, bonusCredits: true,
              trialCredits: true, promotionalCredits: true, lifetimePurchased: true, lifetimeUsed: true },
  });
  console.log('Wallet:', JSON.stringify(wallet, null, 2));

  const sub = await p.subscription.findUnique({
    where: { userId: user.id },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  console.log('Subscription:', JSON.stringify(sub, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
