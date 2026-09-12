'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const EMAIL = process.env.CHECK_EMAIL || 'ethonanpasumvalki@gmail.com';

async function main() {
  const user = await p.user.findFirst({
    where: { email: { equals: EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!user) { console.log('User not found:', EMAIL); return; }
  console.log('\nUser:', JSON.stringify(user, null, 2));

  const [channels, projects, musicTracks, characters, devKeys] = await Promise.all([
    p.channel.count({ where: { userId: user.id } }),
    p.project.count({ where: { userId: user.id } }),
    p.musicTrack.count({ where: { userId: user.id } }),
    p.character.count({ where: { userId: user.id } }),
    p.developerKey.count({ where: { userId: user.id } }),
  ]);

  const importedVideos = await p.importedVideo.count({ where: { project: { userId: user.id } } });
  const videos = await p.video.count({ where: { project: { userId: user.id } } });
  const assets = await p.asset.count({ where: { project: { userId: user.id } } });

  console.log('\nRecords:', { channels, projects, videos, importedVideos, assets, musicTracks, characters, devKeys });
  console.log('');
}

main().catch(console.error).finally(() => p.$disconnect());
