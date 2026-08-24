import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const DEMO_PROJECTS = [
  {
    title: 'SozialZynk — The Creator Revolution (Full Documentary)',
    description:
      'A 12-minute cinematic documentary following real creators who transformed their passion into a thriving business using AI-powered tools. Watch real workflows, real results, and the moment everything changed.',
    niche: 'Platform Documentary',
    contentFormat: 'LONG_FORM',
    platforms: ['YOUTUBE'],
    targetLang: 'en',
  },
  {
    title: 'Inside the AI Studio — How Top Creators Build Viral Content in 2025',
    description:
      'A 12-minute behind-the-scenes journey into the AI-powered content studio that top YouTubers are using right now. Storytelling, animation, and live workflow demonstrations — all in one.',
    niche: 'Creator Education',
    contentFormat: 'LONG_FORM',
    platforms: ['YOUTUBE'],
    targetLang: 'en',
  },
];

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedDemoProjects();
    } catch (err) {
      // Never crash the app on seed failure — log and continue
      this.logger.warn(`Demo seed skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async seedDemoProjects(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo pending Prisma client regen after migration
    const existing = await (this.prisma.project as any).count({ where: { isDemo: true } });
    if ((existing as number) >= DEMO_PROJECTS.length) return;

    const adminEmail = process.env['SUPER_ADMIN_EMAIL'];
    if (!adminEmail) {
      this.logger.warn('SUPER_ADMIN_EMAIL not set — skipping demo project seed');
      return;
    }

    const admin = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      this.logger.warn(`SUPER_ADMIN user ${adminEmail} not found — skipping demo project seed`);
      return;
    }

    for (const project of DEMO_PROJECTS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo pending Prisma client regen after migration
      const alreadyExists = await (this.prisma.project as any).findFirst({
        where: { isDemo: true, title: project.title },
      });
      if (alreadyExists) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo pending Prisma client regen after migration
      await (this.prisma.project as any).create({
        data: {
          userId: admin.id,
          isDemo: true,
          status: 'COMPLETE',
          publishingStatus: 'PUBLISHED',
          ...project,
        },
      });
      this.logger.log(`Seeded demo project: "${project.title}"`);
    }
  }
}
