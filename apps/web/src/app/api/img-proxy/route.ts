import { NextRequest, NextResponse } from 'next/server';

// Allowlist of hostnames we will proxy image content from.
// Extend this list when adding new image providers.
const ALLOWED_HOSTNAMES = new Set([
  'images.pexels.com',
  'images-1.pexels.com',
  'images.unsplash.com',
  'plus.unsplash.com',
  'cdn.pixabay.com',
  'pixabay.com',            // webformatURL and previewURL come from pixabay.com directly
  'api.openverse.org',
  'live.staticflickr.com',
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'openverse.engineering',
]);

// Also allow wildcard suffixes
const ALLOWED_SUFFIXES = ['.staticflickr.com', '.openverse.org', '.pexels.com', '.unsplash.com', '.pixabay.com'];

function isAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTNAMES.has(hostname)) return true;
  return ALLOWED_SUFFIXES.some(s => hostname.endsWith(s));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('Missing url param', { status: 400 });

  let parsed: URL;
  try { parsed = new URL(raw); }
  catch { return new NextResponse('Invalid URL', { status: 400 }); }

  if (parsed.protocol !== 'https:') return new NextResponse('Only HTTPS sources allowed', { status: 400 });
  if (!isAllowed(parsed.hostname)) return new NextResponse('Domain not in allowlist', { status: 403 });

  try {
    const upstream = await fetch(raw, {
      headers: { 'User-Agent': 'Sozialzynk/1.0 image-proxy' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(typeof (globalThis as any).EdgeRuntime === 'undefined' ? { signal: AbortSignal.timeout(8000) } : {}),
    });
    if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

    const ct = upstream.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return new NextResponse('Not an image', { status: 502 });

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('Proxy fetch failed', { status: 502 });
  }
}
