'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SOURCE = process.env.FROM_EMAIL || 'sozialzync@gmail.com';
const TARGET = process.env.TO_EMAIL   || 'ethonanpasumvalki@gmail.com';

async function main() {
  const [src, tgt] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: SOURCE, mode: 'insensitive' } }, select: { id: true, email: true } }),
    prisma.user.findFirst({ where: { email: { equals: TARGET, mode: 'insensitive' } }, select: { id: true, email: true } }),
  ]);
  if (!src) { console.error(`Source not found: ${SOURCE}`); process.exit(1); }
  if (!tgt) { console.error(`Target not found: ${TARGET}`); process.exit(1); }
  console.log(`\nTransferring records`);
  console.log(`  FROM: ${src.email} (${src.id})`);
  console.log(`  TO:   ${tgt.email} (${tgt.id})\n`);

  const ops = [
    ['channels',            prisma.channel.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['projects',            prisma.project.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['videos',              prisma.video.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['assets',              prisma.asset.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['editProjects',        prisma.editProject.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['importedVideos',      prisma.importedVideo.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['scripts',             prisma.script.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['calendarEntries',     prisma.contentCalendarEntry.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['shortsTimelines',     prisma.shortsTimeline.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['musicTracks',         prisma.musicTrack.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['characters',          prisma.character.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
    ['developerKeys',       prisma.developerKey.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } })],
  ];

  for (const [label, op] of ops) {
    try {
      const r = await op;
      if (r.count > 0) console.log(`  ✓ ${label}: ${r.count}`);
    } catch (e) {
      console.log(`  ⚠ ${label}: skipped (${e.message.split('\n')[0]})`);
    }
  }

  console.log('\n✅ Transfer complete.\n');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
