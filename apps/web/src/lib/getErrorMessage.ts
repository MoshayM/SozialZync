type AxiosLike = {
  response?: { data?: unknown; status?: number };
  message?: string;
};

/**
 * Friendly guidance per error-envelope `code` (docs4/32), appended to the
 * server message for categories where the raw text is technical and the fix
 * is on the user's side of the screen (risk R-06: provider outages read as
 * generic failures).
 */
const CODE_HINTS: Record<string, string> = {
  PROVIDER:
    'This is usually a temporary provider outage — nothing was charged. Try again in a moment.',
  RATE_LIMITED: "You're sending requests too quickly — wait a few seconds and try again.",
};

/** Intercepts 403 responses and converts them to clear, user-friendly messages. */
function friendlyForbidden(data: unknown, httpStatus?: number): string | null {
  if (httpStatus !== 403) return null;
  const raw = extractString(data);
  // If the backend message explicitly mentions Pro / upgrade, use it verbatim
  if (raw && /pro|upgrade|plan|credits/i.test(raw)) return raw;
  // Generic 403 fallback — never show "403 Forbidden" to users
  return 'This feature requires a Pro account. Upgrade to Pro ($17/mo) to unlock it — visit your Wallet to upgrade.';
}

function envelopeHint(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const code = (data as Record<string, unknown>)['code'];
  return typeof code === 'string' ? (CODE_HINTS[code] ?? null) : null;
}

function extractString(val: unknown): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (Array.isArray(val)) {
    const parts = val.map((v) => extractString(v)).filter(Boolean) as string[];
    return parts.length ? parts.join('\n') : null;
  }
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // NestJS nested: { message: { message, error, statusCode } }
    if (obj['message'] !== undefined) return extractString(obj['message']);
    if (obj['error'] !== undefined && typeof obj['error'] === 'string') return obj['error'];
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';

  // Axios error — check response.data first
  const axiosErr = error as AxiosLike;
  if (axiosErr?.response !== undefined) {
    const status = (axiosErr.response as { status?: number; data?: unknown }).status;
    const data = axiosErr.response.data;
    // 403 → always show a user-friendly upgrade message
    const forbidden = friendlyForbidden(data, status);
    if (forbidden) return forbidden;
    if (data !== undefined) {
      const fromData = extractString(data);
      const hint = envelopeHint(data);
      if (fromData && hint) return `${fromData.replace(/\.?\s*$/, '.')} ${hint}`;
      if (fromData) return fromData;
      if (hint) return hint;
    }
  }

  // Plain Error or any object with .message
  if (error instanceof Error) return error.message || 'An unexpected error occurred.';

  const fromVal = extractString(error);
  if (fromVal) return fromVal;

  return 'An unexpected error occurred.';
}
