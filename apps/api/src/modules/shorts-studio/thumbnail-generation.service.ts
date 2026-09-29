import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { promises as fsp } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../media/storage.service';
import { runFfmpeg, probeMediaInfo, parseMediaProbe } from '../media/adapters/ffmpeg.util';
import { MediaPipelineError } from '../media/media.errors';

const VARIATIONS = 4;

function buildPromptVariants(base: string, count: number): string[] {
  const suffixes = ['', ', cinematic dramatic lighting', ', bold vibrant graphic design'];
  return suffixes.slice(0, count).map((s) => `${base}${s}`);
}

/**
 * Thumbnail Generator: extracts candidate frames spread across the rendered
 * clip (skipping the first/last 10%). Variations persist as SHORTS_THUMBNAIL
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
      },
    });
    if (!clip?.timeline) throw new NotFoundException('Clip not found');
    if (clip.thumbnails.length > 0) {
      onLog?.(`Thumbnails already exist (${clip.thumbnails.length}) -- reusing`);
      return { skipped: true, thumbnails: clip.thumbnails.length };
    }

    const durationMs = clip.timeline.durationMs;
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cf-thumb-'));

    onLog?.(`Generating ${VARIATIONS} thumbnail variations...`);

    // Validate the render file has a video stream before attempting extraction.
    const probe = await probeMediaInfo(renderedPath);
    this.logger.debug(`Thumbnail probe for ${shortClipId}: ${probe.slice(0, 400).replace(/\n/g, ' ')}`);
    if (!probe.includes('Video:')) {
      throw new InternalServerErrorException(
        'Render file is not a valid video -- no video stream detected. Re-render the clip and try again.',
      );
    }

    // Use the actual rendered video duration from the probe so seek times stay
    // within bounds even when the user made cuts that shorten the timeline.
    // Fall back to the stored durationMs when the probe can't determine it.
    const probedDurationMs = parseMediaProbe(probe).durationMs ?? durationMs;
    const effectiveDurationMs = probedDurationMs > 0 ? probedDurationMs : durationMs;

    let created = 0;
    try {
      for (let i = 0; i < VARIATIONS; i++) {
        // Frames at 15% / 38% / 61% / 84% of the clip -- avoids intro/outro frames
        const atMs = Math.round(effectiveDurationMs * (0.15 + (0.7 * i) / Math.max(1, VARIATIONS - 1)));
        const framePath = path.join(tmpDir, `thumb-${i}.jpg`);

        try {
          // Plain frame extraction without text overlay.
          // Alpine ffmpeg apk omits libfreetype2, so 'drawtext' is unavailable.
          await runFfmpeg(['-ss', String(atMs / 1000), '-i', renderedPath, '-frames:v', '1', '-q:v', '3', framePath], 120_000);
        } catch (ffmpegErr) {
          const reason =
            ffmpegErr instanceof MediaPipelineError
              ? ffmpegErr.reason
              : ffmpegErr instanceof Error
                ? ffmpegErr.message
                : String(ffmpegErr);
          const stderr =
            ffmpegErr instanceof MediaPipelineError ? String(ffmpegErr.details?.['stderrTail'] ?? '') : '';
          this.logger.warn(
            `Thumbnail ${i + 1}/${VARIATIONS} ffmpeg failed -- skipping: ${reason}${stderr ? ` | stderr: ${stderr.slice(0, 300)}` : ''}`,
          );
          continue;
        }

        // Guard: ffmpeg may exit 0 without writing the frame (e.g. empty video
        // or seek precisely at the last keyframe boundary). Skip quietly.
        try {
          const stat = await fsp.stat(framePath);
          if (stat.size === 0) {
            this.logger.warn(`Thumbnail ${i + 1}/${VARIATIONS} ffmpeg wrote empty frame -- skipping`);
            continue;
          }
        } catch {
          this.logger.warn(`Thumbnail ${i + 1}/${VARIATIONS} ffmpeg exited 0 but wrote no output file -- skipping`);
          continue;
        }

        try {
          const buffer = await fsp.readFile(framePath);
          const asset = await this.prisma.asset.create({
            data: {
              projectId: clip.projectId,
              kind: 'SHORTS_THUMBNAIL',
              label: `Thumbnail ${i + 1}: ${clip.id}`,
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
        } catch (err) {
          this.logger.warn(
            `Thumbnail ${i + 1}/${VARIATIONS} storage/db error -- skipping: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (created === 0) {
      throw new InternalServerErrorException(
        'Thumbnail generation failed -- ffmpeg could not extract frames from the render file. Re-render the clip and try again.',
      );
    }
    onLog?.(`Thumbnails ready -- ${created} variations`);
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
    if (!available) throw new BadRequestException('Render file unavailable -- re-render the clip first');

    // Snapshot existing join records. Remove them so ensureThumbnails runs fresh,
    // but keep the Asset DB rows alive so we can restore them if generation fails.
    const existingLinks = await this.prisma.shortsThumbnail.findMany({
      where: { shortClipId },
      select: { assetId: true, id: true },
    });
    if (existingLinks.length > 0) {
      await this.prisma.shortsThumbnail.deleteMany({ where: { shortClipId } });
    }

    try {
      const result = await this.ensureThumbnails(shortClipId, this.storage.resolve(renderKey));
      // Success — remove stale asset DB records that were detached above
      if (existingLinks.length > 0) {
        await this.prisma.asset
          .deleteMany({ where: { id: { in: existingLinks.map((t) => t.assetId) } } })
          .catch((e: Error) => this.logger.warn(`Could not clean up old thumbnail assets for ${shortClipId}: ${e.message}`));
      }
      return result;
    } catch (err) {
      // Restore the old ShortsThumbnail join records so existing thumbnails remain visible.
      // Asset DB rows were intentionally preserved above to make this restore possible.
      if (existingLinks.length > 0) {
        await this.prisma.shortsThumbnail
          .createMany({
            data: existingLinks.map((t, i) => ({ shortClipId, assetId: t.assetId, isPrimary: i === 0 })),
            skipDuplicates: true,
          })
          .catch(() => null);
      }
      throw err;
    }
  }

  /** Upload a user-provided image as a custom thumbnail (JPEG/PNG/WEBP, max 10 MB). */
  async uploadCustom(shortClipId: string, userId: string, buffer: Buffer, mimeType: string) {
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Thumbnail must be <= 10 MB');
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

  /**
   * Download image bytes from DALL-E 3 (portrait 1024×1792) or Pollinations.ai.
   * All variants fire in parallel so wall-clock time ≈ slowest single call.
   */
  // @reason: using `any` here avoids Buffer<ArrayBuffer> vs Buffer<ArrayBufferLike> invariance issues across TS versions
  private async generateAiImageBuffers(prompt: string, count = 3): Promise<Array<{ buffer: any; ext: string }>> {
    const openaiKey = process.env['OPENAI_API_KEY'];
    const variants = buildPromptVariants(
      `YouTube Shorts thumbnail. ${prompt} Portrait 9:16 format, no text overlay, high quality.`,
      count,
    );

    // Per-variant results: null means "needs Pollinations fallback"
    const perVariant: Array<{ buffer: any; ext: string } | null> = variants.map(() => null);

    if (openaiKey) {
      const model = process.env['IMAGE_OPENAI_MODEL'] ?? 'dall-e-3';
      const dalleResults = await Promise.all(
        variants.map(async (variant) => {
          try {
            // Use URL response format — response_format param removed as it is
            // rejected by newer project-scoped API keys (sk-proj-...)
            const res = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model, prompt: variant, n: 1, size: '1024x1792' }),
              signal: AbortSignal.timeout(45_000),
            });
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              this.logger.warn(`DALL-E attempt failed: HTTP ${res.status} — ${errBody.replace(/\s+/g, ' ').slice(0, 400)}`);
              return null;
            }
            const json = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
            const item = json.data?.[0];
            if (!item) return null;
            // Handle both URL (default) and b64_json responses
            if (item.b64_json) {
              return { buffer: Buffer.from(item.b64_json, 'base64'), ext: 'png' as const };
            }
            if (item.url) {
              const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
              if (!imgRes.ok) return null;
              return { buffer: Buffer.from(await imgRes.arrayBuffer()), ext: 'png' as const };
            }
            return null;
          } catch (err) {
            this.logger.warn(`DALL-E variant error: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }),
      );
      dalleResults.forEach((r, i) => { perVariant[i] = r; });
      const dalleCount = dalleResults.filter(Boolean).length;
      if (dalleCount < count) {
        this.logger.log(`DALL-E produced ${dalleCount}/${count} — using Pollinations for the ${count - dalleCount} missing slot(s)`);
      }
    }

    // Fill any null slots with Pollinations.ai (also the sole provider when no OPENAI_API_KEY)
    const missingIndices = perVariant.map((r, i) => (r === null ? i : -1)).filter((i) => i >= 0);
    if (missingIndices.length > 0) {
      const seed = Math.floor(Date.now() / 1000);
      // Stagger variant starts to avoid Pollinations rate-limiting concurrent requests
      const pollinationsResults = await Promise.all(
        missingIndices.map(async (i, arrayIndex) => {
          if (arrayIndex > 0) await new Promise<void>((r) => setTimeout(r, arrayIndex * 3500));
          const variant = variants[i]!;
          for (const model of ['flux', 'turbo']) {
            try {
              const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(variant)}?width=1080&height=1920&nologo=true&model=${model}&seed=${seed + i}`;
              const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
              if (!res.ok) {
                this.logger.warn(`Pollinations ${model} variant ${i + 1} HTTP ${res.status}`);
                if (res.status === 402) await new Promise<void>((r) => setTimeout(r, 1500));
                continue;
              }
              const buffer = Buffer.from(await res.arrayBuffer());
              if (buffer.length > 1000) return { idx: i, result: { buffer, ext: 'jpg' as const } };
            } catch (err) {
              this.logger.warn(`Pollinations ${model} variant ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          return { idx: i, result: null };
        }),
      );
      pollinationsResults.forEach(({ idx, result }) => { perVariant[idx] = result; });
    }

    return perVariant.filter((r): r is Exclude<typeof r, null> => r !== null);
  }

  /**
   * Generate AI thumbnails from a user prompt, enriched with the clip's title.
   * Generates FIRST — only clears old thumbnails after new ones are saved
   * so a generation failure never leaves the clip with zero thumbnails.
   */
  async aiGenerate(shortClipId: string, userId: string, prompt: string) {
    const clip = await this.prisma.shortClip.findFirst({
      where: { id: shortClipId, project: { userId } },
      include: {
        topicSegment: { select: { title: true } },
        chapter: { select: { title: true } },
      },
    });
    if (!clip) throw new NotFoundException('Clip not found');

    // When the caller supplies a prompt, use it as-is — they have full control
    // and adding the clip title risks content-policy rejections (e.g. religious
    // or sensitive titles that are fine on YouTube but flag AI image APIs).
    // Only fall back to a title-derived prompt when no prompt is supplied.
    const clipTitle = clip.topicSegment?.title ?? clip.chapter?.title ?? '';
    const visualPrompt = prompt.trim()
      || (clipTitle ? `Cinematic YouTube Shorts thumbnail for a video titled "${clipTitle}". Dramatic lighting, bold composition, vivid colors, high contrast, no text.` : 'Cinematic YouTube Shorts thumbnail. Dramatic lighting, bold composition, vivid colors, high contrast, no text.');

    this.logger.log(`AI thumbnail generation for clip ${shortClipId}: "${visualPrompt.slice(0, 120)}…"`);

    // Generate FIRST — keeping old thumbnails alive until we know it succeeded.
    const images = await this.generateAiImageBuffers(visualPrompt, 3);
    if (images.length === 0) {
      throw new InternalServerErrorException(
        'AI thumbnail generation failed — no images could be produced. Check OPENAI_API_KEY or try again.',
      );
    }

    // Success — now safe to clear the old thumbnails.
    const existing = await this.prisma.shortsThumbnail.findMany({
      where: { shortClipId },
      select: { assetId: true },
    });
    if (existing.length > 0) {
      await this.prisma.shortsThumbnail.deleteMany({ where: { shortClipId } });
      await this.prisma.asset
        .deleteMany({ where: { id: { in: existing.map((t) => t.assetId) } } })
        .catch((e: Error) => this.logger.warn(`Old thumbnail cleanup error: ${e.message}`));
    }

    let created = 0;
    for (let i = 0; i < images.length; i++) {
      const { buffer, ext } = images[i]!;
      try {
        const asset = await this.prisma.asset.create({
          data: {
            projectId: clip.projectId,
            kind: 'SHORTS_THUMBNAIL',
            label: `AI Thumbnail ${i + 1}: ${clip.id}`,
            status: 'READY',
          },
        });
        const key = `thumbnails/shorts/${clip.projectId}/${asset.id}.${ext}`;
        await this.storage.put(key, buffer);
        const version = await this.prisma.assetVersion.create({
          data: {
            assetId: asset.id,
            version: 1,
            r2Key: key,
            provider: 'ai-generated',
            sizeBytes: BigInt(buffer.length),
            params: { userPrompt: prompt, fullPrompt: visualPrompt, variation: i } as never,
          },
        });
        await this.prisma.asset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
        await this.prisma.shortsThumbnail.create({
          data: { shortClipId, assetId: asset.id, isPrimary: i === 0 },
        });
        created++;
      } catch (err) {
        this.logger.warn(`Failed to store AI thumbnail ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (created === 0) {
      throw new InternalServerErrorException('AI thumbnails were generated but could not be saved — please try again.');
    }

    this.logger.log(`AI thumbnail generation complete: ${created} images for clip ${shortClipId}`);
    return { skipped: false, thumbnails: created, aiGenerated: true };
  }
}
