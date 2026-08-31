import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GRADIENTS: [string, string][] = [
  ['#1a0845', '#4c1d95'],
  ['#0c1445', '#1e3a8a'],
  ['#0a2a1a', '#065f46'],
  ['#2a0a1a', '#9d174d'],
  ['#1a1a0a', '#78350f'],
  ['#0a1a2a', '#075985'],
  ['#1a0a1a', '#701a75'],
  ['#0a0a1a', '#3730a3'],
];

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seed = searchParams.get('seed') ?? 'default';
  const w = Math.min(Math.max(parseInt(searchParams.get('w') ?? '640', 10), 16), 1920);
  const h = Math.min(Math.max(parseInt(searchParams.get('h') ?? '360', 10), 16), 1920);

  const hash = seedHash(seed);
  const [c1, c2] = GRADIENTS[hash % 8];

  // Decorative circle radii relative to smaller dimension
  const r = Math.min(w, h);
  const cx1 = Math.round(w * 0.15);
  const cy1 = Math.round(h * 0.22);
  const cr1 = Math.round(r * 0.18);
  const cx2 = Math.round(w * 0.82);
  const cy2 = Math.round(h * 0.78);
  const cr2 = Math.round(r * 0.14);

  // Play-button triangle centred
  const pcx = Math.round(w / 2);
  const pcy = Math.round(h / 2);
  const pr = Math.round(r * 0.12);
  // equilateral-ish right-facing triangle
  const tx1 = Math.round(pcx - pr * 0.6);
  const ty1 = Math.round(pcy - pr * 0.8);
  const tx2 = Math.round(pcx + pr);
  const ty2 = pcy;
  const tx3 = tx1;
  const ty3 = Math.round(pcy + pr * 0.8);
  const pbr = Math.round(pr * 1.5); // circle bg radius

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="${c1}"/>`,
    `<stop offset="100%" stop-color="${c2}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>`,
    `<circle cx="${cx1}" cy="${cy1}" r="${cr1}" fill="rgba(255,255,255,0.04)"/>`,
    `<circle cx="${cx2}" cy="${cy2}" r="${cr2}" fill="rgba(255,255,255,0.03)"/>`,
    `<circle cx="${pcx}" cy="${pcy}" r="${pbr}" fill="rgba(0,0,0,0.28)"/>`,
    `<polygon points="${tx1},${ty1} ${tx2},${ty2} ${tx3},${ty3}" fill="rgba(255,255,255,0.75)" transform="translate(${Math.round(pr * 0.1)},0)"/>`,
    `</svg>`,
  ].join('');

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Vary': 'Accept-Encoding',
    },
  });
}
