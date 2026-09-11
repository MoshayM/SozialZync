/**
 * Input sanitization utilities — OWASP A03 (Injection) defence-in-depth.
 *
 * These run BEFORE class-validator (via SanitizePipe as APP_PIPE) so that
 * stored values are never raw user HTML.  React's JSX already escapes on
 * render, but sanitising on ingress means even non-React consumers of the
 * API (webhooks, export pipelines) get clean data.
 *
 * No external library needed — the patterns target stored-XSS attack vectors
 * while deliberately NOT stripping harmless plain text (URLs, code, markdown).
 */

// ── String sanitisation ──────────────────────────────────────────────────────

// Patterns ordered by danger level (most destructive first)
const PATTERNS: [RegExp, string][] = [
  // Full script blocks (handles multi-line scripts)
  [/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''],
  // Inline frame embeds
  [/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, ''],
  // Object / embed / applet (plugin execution)
  [/<(?:object|embed|applet)[^>]*>[\s\S]*?<\/(?:object|embed|applet)>/gi, ''],
  [/<(?:object|embed|applet)[^>]*\/?>/gi, ''],
  // SVG can contain script nodes
  [/<svg[\s\S]*?<\/svg>/gi, ''],
  // HTML event handlers: onerror=, onclick=, onload= …
  [/ on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, ''],
  // javascript: URIs (in href, src, action, etc.)
  [/\bjavascript\s*:/gi, 'javascript​:'],
  // data: URIs that deliver HTML/JS (images are fine; text/html is not)
  [/\bdata\s*:\s*text\/html/gi, 'data​:text/html'],
  [/\bdata\s*:\s*application\/(?:javascript|ecmascript)/gi, 'data​:application/script'],
  // CSS expression() — IE-era injection vector
  [/expression\s*\(/gi, 'expression​('],
  // Null bytes — break string operations in many languages
  [/\0/g, ''],
];

/**
 * Sanitise a single string value.
 *
 * Strips script/iframe/event-handler injection patterns and null bytes.
 * Trims whitespace and enforces an absolute maximum length.
 * Does NOT strip arbitrary HTML tags (that would break descriptions with
 * intentional markup like bold/italic).  The focus is on *executable*
 * injection vectors only.
 */
export function sanitizeString(input: string, maxLength = 100_000): string {
  let s = input;
  for (const [pattern, replacement] of PATTERNS) {
    s = s.replace(pattern, replacement);
  }
  return s.slice(0, maxLength).trim();
}

/**
 * Recursively sanitise all string values inside an arbitrary value tree
 * (plain object, array, primitive).  Skips Buffer instances and Date objects
 * to avoid corrupting binary data or timestamp strings.
 */
export function sanitizeDeep(value: unknown, maxLength = 100_000): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value, maxLength);
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v, maxLength));
  if (
    typeof value === 'object' &&
    !(value instanceof Buffer) &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array)
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeDeep(v, maxLength),
      ]),
    );
  }
  return value;
}

// ── Filename sanitisation ────────────────────────────────────────────────────

// Windows reserved device names
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

/**
 * Return a filesystem-safe version of an uploaded filename.
 * Prevents path traversal (../ etc.) and strips characters that are
 * illegal on Windows/Unix or that break shell invocations.
 */
export function sanitizeFilename(name: string): string {
  let s = name
    .replace(/\0/g, '')           // null bytes
    .replace(/[/\\]/g, '_')       // path separators
    .replace(/\.\./g, '__')       // traversal sequences
    .replace(/[<>:"|?*]/g, '_')   // Windows-illegal chars
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars
    .trim()
    .replace(/^\.+/, '_')         // leading dots hide files on Unix
    .slice(0, 255);               // max ext4/NTFS filename length

  if (WINDOWS_RESERVED.test(s)) s = `_${s}`;
  return s || 'upload';
}

// ── File MIME-type validation ────────────────────────────────────────────────

const AUDIO_MIME_ALLOWLIST = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/flac',
  'video/webm', // browser MediaRecorder sometimes reports this for audio-track-only recordings
]);

// Magic-byte signatures for audio/media containers.
// offset defaults to 0; some formats embed their signature at a fixed offset.
const AUDIO_MAGIC: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0x1a, 0x45, 0xdf, 0xa3] },          // WebM / MKV (EBML header)
  { bytes: [0x4f, 0x67, 0x67, 0x53] },           // Ogg (OggS)
  { bytes: [0x49, 0x44, 0x33] },                  // MP3 with ID3 tag
  { bytes: [0xff, 0xfb] },                        // MP3 sync word (MPEG1 L3)
  { bytes: [0xff, 0xf3] },                        // MP3 sync word (MPEG2 L3)
  { bytes: [0xff, 0xf2] },                        // MP3 sync word
  { bytes: [0xff, 0xf1] },                        // AAC ADTS
  { bytes: [0xff, 0xf9] },                        // AAC ADTS
  { bytes: [0x52, 0x49, 0x46, 0x46] },           // WAV / RIFF
  { bytes: [0x66, 0x4c, 0x61, 0x43] },           // FLAC
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // MP4 / M4A (ftyp box at offset 4)
];

function matchesMagic(buf: Buffer, sig: (typeof AUDIO_MAGIC)[number]): boolean {
  const off = sig.offset ?? 0;
  if (buf.length < off + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => buf[off + i] === b);
}

/**
 * Validate an uploaded file is a legitimate audio file.
 *
 * Checks:
 * 1. Declared MIME type is in the audio allowlist (rejects PDF, image, etc.)
 * 2. File magic bytes match a known audio container (prevents MIME spoofing)
 *
 * Throws `BadRequestException` on failure so NestJS returns 400 automatically.
 */
export function validateAudioFile(file: Express.Multer.File): void {
  const { BadRequestException } = require('@nestjs/common') as typeof import('@nestjs/common');

  const mime = (file.mimetype ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  if (!AUDIO_MIME_ALLOWLIST.has(mime)) {
    throw new BadRequestException(
      `Unsupported audio MIME type "${mime}". Allowed: webm, ogg, mp4, mpeg, wav, aac, flac.`,
    );
  }

  const buf = file.buffer;
  if (!buf || buf.length < 8) {
    throw new BadRequestException('Audio file is too small to be valid.');
  }

  const recognised = AUDIO_MAGIC.some((sig) => matchesMagic(buf, sig));
  if (!recognised) {
    throw new BadRequestException(
      'File content does not match a recognised audio format. Please upload a valid audio file.',
    );
  }
}

// ── Image MIME validation ────────────────────────────────────────────────────

const IMAGE_MIME_ALLOWLIST = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const IMAGE_MAGIC: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0xff, 0xd8, 0xff] },                  // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38] },            // GIF87a / GIF89a
  { bytes: [0x52, 0x49, 0x46, 0x46] },            // WebP (RIFF container)
  { bytes: [0x00, 0x00, 0x00], offset: 4 },        // AVIF / HEIF (ftyp box)
];

export function validateImageFile(file: Express.Multer.File): void {
  const { BadRequestException } = require('@nestjs/common') as typeof import('@nestjs/common');

  const mime = (file.mimetype ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  if (!IMAGE_MIME_ALLOWLIST.has(mime)) {
    throw new BadRequestException(
      `Unsupported image MIME type "${mime}". Allowed: jpeg, png, webp, gif, avif.`,
    );
  }

  const buf = file.buffer;
  if (!buf || buf.length < 8) {
    throw new BadRequestException('Image file is too small to be valid.');
  }

  const recognised = IMAGE_MAGIC.some((sig) => matchesMagic(buf, sig));
  if (!recognised) {
    throw new BadRequestException(
      'File content does not match a recognised image format.',
    );
  }
}
