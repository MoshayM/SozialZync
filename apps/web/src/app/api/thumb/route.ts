import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PALETTES: [string, string, string][] = [
  ['#1a0845', '#4c1d95', '#7c3aed'],
  ['#0c1445', '#1e3a8a', '#2563eb'],
  ['#0a2a1a', '#065f46', '#059669'],
  ['#2a0a1a', '#9d174d', '#db2777'],
  ['#1a1a0a', '#78350f', '#d97706'],
  ['#0a1a2a', '#075985', '#0284c7'],
  ['#1a0a1a', '#701a75', '#a21caf'],
  ['#0a0a1a', '#3730a3', '#4f46e5'],
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
  const showPlay = searchParams.get('kind') !== 'image';

  const hash = seedHash(seed);
  const [c1, c2, c3] = PALETTES[hash % 8];
  const r = Math.min(w, h);

  // Decorative blob circles — varied positions per seed
  const blobs = [
    { cx: Math.round(w * 0.12), cy: Math.round(h * 0.18), r: Math.round(r * 0.22), o: 0.07 },
    { cx: Math.round(w * 0.88), cy: Math.round(h * 0.82), r: Math.round(r * 0.18), o: 0.06 },
    { cx: Math.round(w * 0.75), cy: Math.round(h * 0.15), r: Math.round(r * 0.13), o: 0.05 },
    { cx: Math.round(w * 0.25), cy: Math.round(h * 0.85), r: Math.round(r * 0.10), o: 0.04 },
  ];

  // Scan-line strip (horizontal rule at 60% height) — subtle texture
  const lineY = Math.round(h * 0.6);

  // Play button centred
  const pcx = Math.round(w / 2);
  const pcy = Math.round(h / 2);
  const pbr = Math.round(r * 0.13);  // outer circle radius
  const pt = Math.round(r * 0.065);  // triangle half-height
  const tx1 = Math.round(pcx - pt * 0.7);
  const ty1 = Math.round(pcy - pt);
  const tx2 = Math.round(pcx + pt * 1.0);
  const ty2 = pcy;
  const tx3 = tx1;
  const ty3 = Math.round(pcy + pt);

  const blobsSvg = blobs
    .map(b => `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${c3}" opacity="${b.o}"/>`)
    .join('');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="${c1}"/>`,
    `<stop offset="60%" stop-color="${c2}"/>`,
    `<stop offset="100%" stop-color="${c1}"/>`,
    `</linearGradient>`,
    `<radialGradient id="vignette" cx="50%" cy="50%" r="70%">`,
    `<stop offset="0%" stop-color="transparent"/>`,
    `<stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>`,
    `</radialGradient>`,
    `<radialGradient id="glow" cx="50%" cy="50%" r="50%">`,
    `<stop offset="0%" stop-color="${c3}" stop-opacity="0.18"/>`,
    `<stop offset="100%" stop-color="transparent"/>`,
    `</radialGradient>`,
    `</defs>`,
    // Background gradient
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>`,
    // Centre radial glow
    `<rect width="${w}" height="${h}" fill="url(#glow)"/>`,
    // Decorative blobs
    blobsSvg,
    // Subtle scan line
    `<line x1="0" y1="${lineY}" x2="${w}" y2="${lineY}" stroke="${c3}" stroke-width="1" opacity="0.08"/>`,
    // Vignette overlay
    `<rect width="${w}" height="${h}" fill="url(#vignette)"/>`,
    // Play button (video only)
    ...(showPlay ? [
      `<circle cx="${pcx + 2}" cy="${pcy + 2}" r="${pbr}" fill="rgba(0,0,0,0.35)"/>`,
      `<circle cx="${pcx}" cy="${pcy}" r="${pbr}" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.20)" stroke-width="1.5"/>`,
      `<polygon points="${tx1},${ty1} ${tx2},${ty2} ${tx3},${ty3}" fill="rgba(255,255,255,0.82)" transform="translate(${Math.round(pt * 0.15)},0)"/>`,
    ] : []),
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
