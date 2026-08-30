import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#111827',
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="106" height="74" viewBox="76 138 360 236" fill="none">
          <path
            d="M96 148H280L96 364H280"
            stroke="#F9FAFB"
            stroke-width="38"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M318 148V364M318 256L416 148M318 256L416 364"
            stroke="#9CA3AF"
            stroke-width="32"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
