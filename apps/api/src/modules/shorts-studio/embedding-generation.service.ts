import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { embedTexts } from '@cf/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Segments per provider round-trip; each chunk persists before the next starts. */
const CHUNK_SIZE = 100;

/**
 * EMBEDDING_GENERATION job (Ai-video edit.md §5, Phase 5). Fills
 * TranscriptSegment.embedding for every segment that doesn't have one yet —
 * so the job is naturally resumable (a crashed run left the finished chunks
 * persisted) and self-skips when the video is fully embedded (ai.md 16.1).
 * Vectors are unit-normalized by embedTexts, so search is a dot product.
 */
@Injectable()
export class EmbeddingGenerationService {
  private readonly logger = new Logger(EmbeddingGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureEmbeddings(importedVideoId: string, onLog?: (msg: string) => void) {
    const video = await this.prisma.importedVideo.findUnique({ where: { id: importedVideoId } });
    if (!video) throw new NotFoundException('Imported video not found');

    const total = await this.prisma.transcriptSegment.count({ where: { importedVideoId } });
    if (total === 0) throw new Error('No transcript segments — run TRANSCRIPT_ANALYSIS first');

    const pending = await this.prisma.transcriptSegment.findMany({
      where: { importedVideoId, embedding: { isEmpty: true } },
      orderBy: { startMs: 'asc' },
      select: { id: true, text: true },
    });
    if (pending.length === 0) {
      onLog?.(`Embeddings already complete (${total} segments) — reusing`);
      return { skipped: true, embedded: total };
    }
    if (pending.length < total) {
      onLog?.(`Resuming embeddings — ${total - pending.length}/${total} segments already embedded`);
    }

    let done = 0;
    let skippedChunks = 0;
    let tokensIn = 0;
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      onLog?.(`Embedding segments ${i + 1}–${i + chunk.length}/${pending.length}…`);
      try {
        const result = await embedTexts(chunk.map((s) => s.text));
        tokensIn += result.tokensIn;
        await this.prisma.$transaction(
          chunk.map((s, j) =>
            this.prisma.transcriptSegment.update({
              where: { id: s.id },
              data: { embedding: result.embeddings[j]! },
            }),
          ),
        );
        done += chunk.length;
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        const msg = err instanceof Error ? err.message : String(err);
        const isQuota = status === 429 || /quota|rate.?limit/i.test(msg);
        // Treat all provider errors (quota, bad params, auth, network) as non-fatal
        // so that a missing key or unsupported parameter never fails the parent pipeline.
        // Semantic search degrades gracefully — clips and analysis are already done.
        const logSuffix = isQuota ? '(will retry on next run)' : `(error: ${msg.slice(0, 120)})`;
        this.logger.warn(`[EmbeddingGeneration] Skipping chunk ${i + 1}–${i + chunk.length} ${logSuffix}`);
        onLog?.(`Warning: chunk ${i + 1}–${i + chunk.length} skipped — semantic search will be partial ${logSuffix}`);
        skippedChunks++;
      }
    }

    if (skippedChunks > 0) {
      onLog?.(`Embedding generation partial — ${done} embedded, ${skippedChunks} chunk(s) skipped (re-run after fixing API key/quota to complete)`);
    } else {
      onLog?.(`Embedding generation complete — ${done} new (${total} total, ${tokensIn} tokens)`);
    }
    return { skipped: false, embedded: done, partiallySkipped: skippedChunks > 0 };
  }
}
