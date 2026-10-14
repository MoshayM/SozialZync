export interface CueLike {
  index?: number;
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Linearly rescale cue timings so the last cue ends within targetMs.
 * No-op (returns the input array) when cues already fit within targetMs + graceMs.
 */
export function fitCuesToDuration<T extends CueLike>(
  cues: T[],
  targetMs: number,
  graceMs = 5000,
): { cues: T[]; scaled: boolean } {
  if (cues.length === 0 || targetMs <= 0) return { cues, scaled: false };

  const lastEnd = Math.max(...cues.map((c) => c.endMs));
  if (lastEnd <= 0 || lastEnd <= targetMs + graceMs) return { cues, scaled: false };

  const factor = targetMs / lastEnd;
  const mapped = cues.map((c) => {
    const newStart = Math.round(c.startMs * factor);
    const newEnd = Math.max(Math.round(c.endMs * factor), newStart + 300);
    return { ...c, startMs: newStart, endMs: newEnd };
  }) as T[];

  return { cues: mapped, scaled: true };
}

function timestamp(ms: number, msSeparator: ',' | '.'): string {
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  const frac = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s}${msSeparator}${frac}`;
}

/**
 * Deterministic SRT/VTT serialization from cue data
 * (docs1/media-pipeline.md §7: subtitles derive from structured cues —
 * mechanical formats are never delegated to an LLM).
 */
export function buildSrt(cues: CueLike[]): string {
  return cues
    .map((c, i) => `${c.index ?? i + 1}\n${timestamp(c.startMs, ',')} --> ${timestamp(c.endMs, ',')}\n${c.text}`)
    .join('\n\n') + '\n';
}

export function buildVtt(cues: CueLike[]): string {
  return 'WEBVTT\n\n' + cues
    .map((c) => `${timestamp(c.startMs, '.')} --> ${timestamp(c.endMs, '.')}\n${c.text}`)
    .join('\n\n') + '\n';
}

/**
 * Build an ASS (Advanced SubStation Alpha) subtitle file optimised for
 * short-form vertical video (Shorts / Reels / TikTok).
 * Large bold white text with a strong outline sits in the lower safe zone,
 * clearly above platform UI chrome on mobile screens.
 */
export function buildAss(cues: CueLike[], opts?: {
  /** Font size in ASS pixels. Default 60 for vertical, 48 otherwise. */
  fontSize?: number;
  /** When true, uses vertical-video defaults (larger font, higher margin). */
  isVertical?: boolean;
  /** Script reference width (should match video width). Default 1080. */
  playResX?: number;
  /** Script reference height (should match video height). Default 1920 for vertical, 1080 otherwise. */
  playResY?: number;
}): string {
  const isVert = opts?.isVertical ?? false;
  const fontSize = opts?.fontSize ?? (isVert ? 60 : 48);
  const playResX = opts?.playResX ?? 1080;
  const playResY = opts?.playResY ?? (isVert ? 1920 : 1080);
  // MarginV: distance from bottom edge. 180px in a 1920-high frame keeps text
  // above TikTok/Reels action buttons (~120px) with comfortable breathing room.
  const marginV = isVert ? 180 : 80;

  // ASS color format: &HAABBGGRR (alpha, blue, green, red in hex)
  const white = '&H00FFFFFF';
  const transparent = '&H00000000';
  const darkShadow = '&H90000000';

  function assTime(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,Arial,${fontSize},${white},${transparent},${transparent},${darkShadow},1,0,0,0,100,100,0,0,1,2.5,1.5,2,40,40,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const events = cues.map((c) =>
    `Dialogue: 0,${assTime(c.startMs)},${assTime(c.endMs)},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`,
  ).join('\n');

  return `${header}\n${events}\n`;
}
