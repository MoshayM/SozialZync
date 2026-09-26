import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { promises as fsp, existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../media/storage.service';
import { runFfmpeg, escapeFilterPath } from '../media/adapters/ffmpeg.util';

const VARIATIONS = 4;

function findFont(): string | null {
  const candidates = [
    // Windows
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/arial.ttf',
    // Debian/Ubuntu — liberation-fonts (most common on Railway)
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    // Debian/Ubuntu — dejavu
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    // Alpine Linux (Railway default base image)
    '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/ttf-liberation/LiberationSans-Bold.ttf',
    // Ubuntu / Noto
    '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf',
    '/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf',
    // Fallback FreeFonts
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Thumbnail Generator (ai.md Section 13): extracts candidate frames spread
 * across the rendered clip (skipping the first/last 10%) and overlays the
 * highlight's title suggestion. Variations persist as SHORTS_THUMBNAIL
 * assets + ShortsThumbnail rows; the first becomes primary until the user
 * picks another. Skips when thumbnails already exist.
 */
@Injectable()
export class ThumbnailGenerationService {
  private readonly logger = new Logger(ThumbnailGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async ensureThumbnails(shortClipId: string, renderedPath: string, onLog?: (msg: string) => void) {
    const clip = await this.prisma.shortClip.findUnique({
      where: { id: shortClipId },
      include: {
        thumbnails: true,
        timeline: { select: { durationMs: true } },
        topicSegment: { include: { highlight: { select: { titleSuggestion: true } } } },
        chapter: { select: { title: true } },
      },
    });
    if (!clip?.timeline) throw new NotFoundException('Clip not found');
    if (clip.thumbnails.length > 0) {
      onLog?.(`Thumbnails already exist (${clip.thumbnails.length}) — reusing`);
      return { skipped: true, thumbnails: clip.thumbnails.length };
    }

    const durationMs = clip.timeline.durationMs;
    const title = clip.topicSegment?.highlight?.titleSuggestion ?? clip.chapter?.title ?? '';
    const font = findFont();
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cf-thumb-'));

    onLog?.(`Generating ${VARIATIONS} thumbnail variations…`);
    if (!font) this.logger.warn('No usable font found for drawtext — thumbnails will be generated without title overlay');
    let created = 0;
    try {
      for (let i = 0; i < VARIATIONS; i++) {
        // Frames at 15% / 38% / 61% / 84% of the clip — avoids intro/outro frames
        const atMs = Math.round(durationMs * (0.15 + (0.7 * i) / Math.max(1, VARIATIONS - 1)));
        const framePath = path.join(tmpDir, `thumb-${i}.jpg`);

        const filters: string[] = [];
        if (font && title) {
          // Alternate top/bottom placement across variations
          const y = i % 2 === 0 ? 'h*0.08' : 'h*0.78';
          const safeTitle = title.replace(/\\/g, '').replace(/'/g, '’').replace(/:/g, '\\:').replace(/%/g, '\\%').slice(0, 60);
          filters.push(
            `drawtext=fontfile='${escapeFilterPath(font)}':text='${safeTitle}':fontcolor=white:borderw=6:bordercolor=black@0.8:fontsize=h*0.055:x=(w-text_w)/2:y=${y}`,
          );
        }

        try {
          await runFfmpeg([
            '-ss', String(atMs / 1000),
            '-i', renderedPath,
            ...(filters.length ? ['-vf', filters.join(',')] : []),
            '-frames:v', '1', '-q:v', '3',
            framePath,
          ], 120_000);
        } catch (ffmpegErr) {
          this.logger.warn(`Thumbnail ${i + 1}/${VARIATIONS} ffmpeg failed — skipping variation: ${ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr)}`);
          continue;
        }

        const buffer = await fsp.readFile(framePath);
        const asset = await this.prisma.asset.create({
          data: {
            projectId: clip.projectId,
            kind: 'SHORTS_THUMBNAIL',
            label: `Thumbnail ${i + 1}: ${title || clip.id}`,
            status: 'READY',
          },
        });
        const key = `thumbnails/shorts/${clip.projectId}/${asset.id}.jpg`;
        await this.storage.put(key, buffer);
        const version = await this.prisma.assetVersion.create({
          data: {
            assetId: asset.id,
            version: 1,
            r2Key: key,
            provider: 'ffmpeg',
            sizeBytes: BigInt(buffer.length),
            params: { atMs, variation: i } as never,
          },
        });
        await this.prisma.asset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
        await this.prisma.shortsThumbnail.create({
          data: { shortClipId, assetId: asset.id, isPrimary: i === 0 },
        });
        created++;
      }
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (created === 0) throw new Error('All thumbnail variations failed — check ffmpeg and the rendered clip file');
    onLog?.(`Thumbnails ready — ${created} variations`);
    return { skipped: false, thumbnails: created };
  }

  async listForClip(shortClipId: string) {
    return this.prisma.shortsThumbnail.findMany({
      where: { shortClipId },
      orderBy: { createdAt: 'asc' },
      include: { asset: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true } } } } },
    });
  }

  async setPrimary(thumbnailId: string, userId: string) {
    const thumb = await this.prisma.shortsThumbnail.findFirst({
      where: { id: thumbnailId, shortClip: { project: { userId } } },
    });
    if (!thumb) throw new NotFoundException('Thumbnail not found');
    await this.prisma.$transaction([
      this.prisma.shortsThumbnail.updateMany({ where: { shortClipId: thumb.shortClipId }, data: { isPrimary: false } }),
      this.prisma.shortsThumbnail.update({ where: { id: thumbnailId }, data: { isPrimary: true } }),
    ]);
    return { success: true };
  }

  /** Re-generate thumbnails from the already-rendered clip file (force=true clears existing ones first). */
  async regenerate(shortClipId: string, userId: string) {
    const clip = await this.prisma.shortClip.findFirst({
      where: { id: shortClipId, project: { userId } },
      include: {
        renderAsset: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
      },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    const renderKey = clip.renderAsset?.versions[0]?.r2Key;
    if (!renderKey) throw new BadRequestException('Clip must be rendered before generating thumbnails');

    const available = await this.storage.ensure(renderKey);
    if (!available) throw new BadRequestException('Render file unavailable — re-render the clip first');

    // Clear existing thumbnails so ensureThumbnails runs fresh
    const existing = await this.prisma.shortsThumbnail.findMany({ where: { shortClipId }, select: { assetId: true, id: true } });
    if (existing.length > 0) {
      await this.prisma.shortsThumbnail.deleteMany({ where: { shortClipId } });
      await this.prisma.asset.deleteMany({ where: { id: { in: existing.map((t) => t.assetId) } } });
    }

    return this.ensureThumbnails(shortClipId, this.storage.resolve(renderKey));
  }

  /** Upload a user-provided image as a custom thumbnail (JPEG/PNG/WEBP, max 10 MB). */
  async uploadCustom(shortClipId: string, userId: string, buffer: Buffer, mimeType: string) {
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Thumbnail must be ≤ 10 MB');
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) throw new BadRequestException('Thumbnail must be JPEG, PNG, or WebP');

    const clip = await this.prisma.shortClip.findFirst({
      where: { id: shortClipId, project: { userId } },
      select: { id: true, projectId: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const asset = await this.prisma.asset.create({
      data: { projectId: clip.projectId, kind: 'SHORTS_THUMBNAIL', label: `Custom thumbnail: ${clip.id}`, status: 'READY' },
    });
    const key = `thumbnails/shorts/${clip.projectId}/${asset.id}.${ext}`;
    await this.storage.put(key, buffer);
    const version = await this.prisma.assetVersion.create({
      data: { assetId: asset.id, version: 1, r2Key: key, provider: 'user-upload', sizeBytes: BigInt(buffer.length) },
    });
    await this.prisma.asset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });

    // Make the uploaded thumbnail primary, demote all others
    await this.prisma.$transaction([
      this.prisma.shortsThumbnail.updateMany({ where: { shortClipId }, data: { isPrimary: false } }),
      this.prisma.shortsThumbnail.create({ data: { shortClipId, assetId: asset.id, isPrimary: true } }),
    ]);

    return { id: asset.id, key, versionId: version.id };
  }

  /** Resolved local path + R2 key for the primary thumbnail of a clip, or null. */
  async primaryThumbnailPath(shortClipId: string): Promise<{ localPath: string; r2Key: string } | null> {
    const thumb = await this.prisma.shortsThumbnail.findFirst({
      where: { shortClipId, isPrimary: true },
      include: { asset: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    });
    const r2Key = thumb?.asset.versions[0]?.r2Key;
    if (!r2Key) return null;
    const available = await this.storage.ensure(r2Key);
    if (!available) return null;
    return { localPath: this.storage.resolve(r2Key), r2Key };
  }
}
