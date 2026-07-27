import { type NextRequest, NextResponse } from 'next/server';

// Always run fresh — never cache proxy responses.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4007/api/v1'
).replace(/\/+$/, '');

// Hop-by-hop headers that must not be forwarded upstream or downstream.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'te', 'trailer',
]);

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  // In Next.js 15 params are async.
  const { path } = await ctx.params;
  const pathStr = path.join('/');
  const upstreamUrl = `${API_BASE}/${pathStr}${req.nextUrl.search}`;

  const method = req.method;
  const hasBody = !['GET', 'HEAD'].includes(method);

  // ── Forward request headers (minus hop-by-hop + host + content-length) ──
  // Drop content-length so fetch recalculates it from the buffered body.
  const fwdHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'host' || k === 'content-length' || HOP_BY_HOP.has(k)) return;
    fwdHeaders[key] = value;
  });

  // ── Fetch upstream ────────────────────────────────────────────────────────
  let upstreamRes: Response;
  try {
    const body = hasBody ? await req.arrayBuffer() : undefined;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 55_000);
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method,
        headers: fwdHeaders,
        body: body && body.byteLength > 0 ? body : undefined,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error(`[proxy] upstream ${isTimeout ? 'timeout' : 'unreachable'} ${upstreamUrl}:`, err);
    return NextResponse.json(
      { message: isTimeout ? 'Request timed out — the AI is taking longer than expected. Please try again.' : 'Cannot reach the API server. Please try again later.' },
      { status: isTimeout ? 504 : 502 },
    );
  }

  // ── Strip hop-by-hop from response headers ────────────────────────────────
  const resHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'content-encoding' || HOP_BY_HOP.has(k)) return;
    resHeaders.set(key, value);
  });

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
