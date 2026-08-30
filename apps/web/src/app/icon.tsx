import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#111827',
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Zk lettermark — white Z, gray k, centred with ~22% padding on each side */}
        <svg width="300" height="210" viewBox="76 138 360 236" fill="none">
          {/* Z — white */}
          <path
            d="M96 148H280L96 364H280"
            stroke="#F9FAFB"
            stroke-width="38"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          {/* k — medium gray */}
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
