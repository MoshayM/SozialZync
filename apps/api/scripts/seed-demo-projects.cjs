/**
 * Seed 2 public demo/advertisement projects for SozialZynk.
 * These are realistic human storytelling/drama + animation style,
 * ~12 minutes each, visible to ALL users, editable only by SUPER_ADMIN.
 *
 * Usage: node apps/api/scripts/seed-demo-projects.cjs
 * Run from repo root. Requires DATABASE_URL env var.
 */

'use strict';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env['SUPER_ADMIN_EMAIL'] || 'Digiaim_group1@iimcal.ac.in';

const DEMO_PROJECTS = [
  {
    title: 'SozialZynk — The Creator Revolution (Full Documentary)',
    description:
      'A 12-minute cinematic documentary following three real creators — a chef, a fitness coach, and a travel blogger — as they transform their passion into thriving businesses using AI. ' +
      'Featuring authentic human storytelling, dramatic turning points, and stunning AI-assisted animations that bring their journeys to life. ' +
      'Produced entirely on SozialZynk: research, scripting, voiceover, music, and publishing — all in one platform.',
    niche: 'Creator Economy',
    contentFormat: 'DOCUMENTARY',
    platforms: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'],
    script: {
      hook: "Three creators. One decision that changed everything. This is their story.",
      estimatedDurationMins: 12,
      sections: [
        { title: 'Act 1 — The Breaking Point', content: 'Meet Sarah, a chef posting recipes for 3 years with zero traction. Meet James, a fitness coach burning out from content creation. Meet Priya, a travel blogger struggling to monetize her passion. All three hit a wall at the same moment.' },
        { title: 'Act 2 — The Discovery', content: 'They each discover SozialZynk. We follow their first projects in real time — the AI researching their niche, generating scripts, selecting music, creating thumbnails. The drama of seeing your vision come to life in hours instead of weeks.' },
        { title: 'Act 3 — The Transformation', content: 'Six months later. Sarah\'s channel hits 100K. James launches a paid program. Priya lands brand deals. Animation sequences visualize their growth data. Emotional interviews reveal what changed beyond the numbers.' },
        { title: 'Outro — Your Turn', content: 'The platform\'s capabilities shown in a fast-paced montage. Call to action: Start your creator journey today.' },
      ],
      callToAction: 'Start your free trial at SozialZynk — link in bio.',
      targetKeywords: ['AI creator tools', 'YouTube growth', 'creator economy 2025', 'SozialZynk'],
    },
    thumbnailPrompt: 'Cinematic split-screen showing three diverse creators at their lowest point transitioning to their success moment, dramatic lighting, emotional, photorealistic',
    musicBrief: { mood: 'inspiring', genre: 'cinematic', bpm: 88, energy: 'dynamic' },
    estimatedDuration: 720, // 12 minutes in seconds
  },
  {
    title: 'Inside the AI Studio — How Top Creators Build Viral Content in 2025',
    description:
      'An intimate, behind-the-scenes drama following a day in the life of a top creator using SozialZynk\'s full AI pipeline. ' +
      'From morning research to midnight publishing, with realistic dramatized moments of creative struggle and breakthrough. ' +
      'Includes stunning AI animation sequences explaining how each platform algorithm works, making complex concepts visual and engaging. ' +
      'This is not a tutorial — it\'s a story about the future of human creativity.',
    niche: 'Social Media Strategy',
    contentFormat: 'DOCUMENTARY',
    platforms: ['YOUTUBE', 'INSTAGRAM'],
    script: {
      hook: "6 AM. One creator. One AI platform. 12 hours to create a viral video from scratch. Let's go.",
      estimatedDurationMins: 12,
      sections: [
        { title: 'Morning — The Research Phase', content: 'We watch Alex (a real creator) open SozialZynk. The Trend Scout agent surfaces a viral topic. Animation shows how the algorithm works beneath the surface — data flowing, patterns emerging, opportunities identified in real time.' },
        { title: 'Midday — Script & Voice', content: 'The script writes itself from research. Alex edits, personalizes, adds her unique angle. The AI voice generation creates a natural narration. Drama: will the compliance check pass? A tense moment when one claim needs fact-verification.' },
        { title: 'Afternoon — Visuals & Music', content: 'Thumbnail generation in seconds. AI selects music matching the video\'s emotional arc. Animation sequence: how YouTube\'s recommendation algorithm decides who sees your video — visualized as a stunning network graph.' },
        { title: 'Evening — Publish & Promote', content: 'The video goes live. Real-time analytics dashboard shown. The Copilot AI answers audience comments automatically. By midnight, the video is trending. Alex reflects on what this means for creators everywhere.' },
      ],
      callToAction: 'Create your first AI-powered video free. SozialZynk.com',
      targetKeywords: ['AI video creation', 'YouTube automation', 'content creation tools', 'viral video strategy'],
    },
    thumbnailPrompt: 'Creator at a glowing holographic workstation surrounded by floating AI visualizations, dramatic studio lighting, cinematic quality, photorealistic with subtle animation elements',
    musicBrief: { mood: 'focused and determined', genre: 'electronic ambient', bpm: 110, energy: 'high' },
    estimatedDuration: 728, // 12 minutes 8 seconds
  },
];

async function main() {
  console.log('🎬 Seeding demo projects...');

  // Find or create a system/seed user to own the demo projects
  let seedUser = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });

  if (!seedUser) {
    console.log(`⚠️  Super admin user ${SUPER_ADMIN_EMAIL} not found. Create the admin user first.`);
    console.log('   Run: node apps/api/scripts/setup-admins.cjs');
    process.exit(1);
  }

  console.log(`✓ Found seed user: ${seedUser.email}`);

  for (const demo of DEMO_PROJECTS) {
    const existing = await prisma.project.findFirst({
      where: { userId: seedUser.id, title: demo.title },
    });

    if (existing) {
      // Ensure isDemo is set on existing project
      await prisma.project.update({
        where: { id: existing.id },
        data: { isDemo: true, publishingStatus: 'PUBLISHED' },
      });
      console.log(`  ↺ Updated existing demo project: "${demo.title}"`);
      continue;
    }

    const project = await prisma.project.create({
      data: {
        userId: seedUser.id,
        title: demo.title,
        description: demo.description,
        niche: demo.niche,
        contentFormat: demo.contentFormat,
        platforms: demo.platforms,
        isDemo: true,
        status: 'COMPLETE',
        publishingStatus: 'PUBLISHED',
        targetLang: 'en',
      },
    });

    console.log(`  ✓ Created demo project: "${demo.title}" (id: ${project.id})`);
  }

  console.log('\n✅ Demo projects seeded successfully.');
  console.log('   These are now visible on the /browse page to all users.');
  console.log('   Only SUPER_ADMIN accounts can edit or delete them.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
