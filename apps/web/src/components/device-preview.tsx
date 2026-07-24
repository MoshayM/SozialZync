'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, LayoutGrid, Laptop, Maximize2, RefreshCw, Smartphone, Tablet } from 'lucide-react';

// ── Device catalogue ──────────────────────────────────────────────────────────

type DeviceType = 'phone' | 'tablet' | 'laptop';
type NotchKind  = 'android-pill' | 'dynamic-island' | 'camera-dot' | 'webcam-dot' | 'none';

interface DeviceDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  w: number;       // screen / viewport width
  h: number;       // screen / viewport height
  bt: number;      // bezel top
  br: number;      // bezel right
  bb: number;      // bezel bottom
  bl: number;      // bezel left
  radius: number;  // outer shell border-radius
  type: DeviceType;
  notch: NotchKind;
  shell: string;   // shell background colour
}

const DEVICES: DeviceDef[] = [
  {
    id: 'android', label: 'Android', icon: Smartphone,
    w: 393, h: 851,
    bt: 54, br: 14, bb: 46, bl: 14, radius: 46,
    type: 'phone', notch: 'android-pill', shell: '#1a1a2e',
  },
  {
    id: 'iphone', label: 'iPhone', icon: Smartphone,
    w: 393, h: 852,
    bt: 54, br: 14, bb: 46, bl: 14, radius: 50,
    type: 'phone', notch: 'dynamic-island', shell: '#1c1c24',
  },
  {
    id: 'ipad', label: 'iPad', icon: Tablet,
    w: 820, h: 1180,
    bt: 26, br: 22, bb: 26, bl: 22, radius: 22,
    type: 'tablet', notch: 'camera-dot', shell: '#2a2a38',
  },
  {
    id: 'macbook', label: 'MacBook', icon: Laptop,
    w: 1280, h: 800,
    bt: 30, br: 18, bb: 18, bl: 18, radius: 10,
    type: 'laptop', notch: 'webcam-dot', shell: '#d2d2da',
  },
];

const PAGES = [
  { id: '/',         label: 'Landing' },
  { id: '/login',    label: 'Login' },
  { id: '/home',     label: 'Dashboard' },
  { id: '/content',  label: 'Content' },
  { id: '/projects', label: 'Projects' },
  { id: '/publish',  label: 'Publish' },
  { id: '/settings', label: 'Settings' },
];

// ── Notch ─────────────────────────────────────────────────────────────────────

function Notch({ dev }: { dev: DeviceDef }) {
  const dot = dev.shell === '#d2d2da' ? '#909098' : '#07070f';

  if (dev.notch === 'android-pill') {
    return (
      <div style={{
        position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
        width: 90, height: 24, borderRadius: 12, background: dot,
      }} />
    );
  }
  if (dev.notch === 'dynamic-island') {
    return (
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        width: 74, height: 24, borderRadius: 14, background: dot,
      }} />
    );
  }
  if (dev.notch === 'camera-dot') {
    return (
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        width: 10, height: 10, borderRadius: '50%', background: '#484858',
      }} />
    );
  }
  if (dev.notch === 'webcam-dot') {
    return (
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%', background: '#a0a0a8',
      }} />
    );
  }
  return null;
}

// ── Device frame ──────────────────────────────────────────────────────────────

const BASE_EXTRA = 20; // keyboard deck extends this many px on each side of the screen shell
const BASE_H     = 54; // total keyboard deck height

const DeviceFrame = memo(function DeviceFrame({
  dev, page, scale, refreshKey,
}: {
  dev: DeviceDef;
  page: string;
  scale: number;
  refreshKey: number;
}) {
  const isMac  = dev.type === 'laptop';
  const shellW = dev.w + dev.bl + dev.br;
  const shellH = dev.h + dev.bt + dev.bb;
  const outerW = isMac ? shellW + BASE_EXTRA * 2 : shellW;
  const outerH = isMac ? shellH + BASE_H : shellH;

  return (
    // Outer div reserves the scaled display area
    <div style={{ width: outerW * scale, height: outerH * scale, flexShrink: 0 }}>
      {/* Single scale transform wrapper */}
      <div style={{ transformOrigin: '0 0', transform: `scale(${scale})`, width: outerW, height: outerH }}>

        {/* Screen shell */}
        <div style={{
          position: 'relative',
          width: shellW,
          height: shellH,
          marginLeft: isMac ? BASE_EXTRA : 0,
          background: dev.shell,
          borderRadius: dev.radius,
          boxShadow: isMac
            ? '0 4px 20px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)'
            : '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.07) inset',
        }}>
          <Notch dev={dev} />

          {/* Iframe viewport */}
          <div style={{
            position: 'absolute',
            top: dev.bt, left: dev.bl,
            width: dev.w, height: dev.h,
            overflow: 'hidden',
            borderRadius: isMac ? 4 : Math.max(2, dev.radius - 14),
            background: '#111',
          }}>
            <iframe
              key={`${refreshKey}::${page}`}
              src={page}
              title={`${dev.label} — ${page}`}
              style={{ width: dev.w, height: dev.h, border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>

        {/* MacBook keyboard deck */}
        {isMac && (
          <>
            {/* Hinge */}
            <div style={{
              marginLeft: BASE_EXTRA,
              width: shellW,
              height: 4,
              background: '#b4b4bc',
            }} />
            {/* Deck */}
            <div style={{
              width: outerW,
              height: BASE_H - 4,
              background: '#c6c6ce',
              borderRadius: '0 0 14px 14px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 10,
            }}>
              {/* Trackpad */}
              <div style={{ width: 190, height: 28, background: '#b4b4bc', borderRadius: 6 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ── Compare-mode grid ─────────────────────────────────────────────────────────

function CompareGrid({ page, containerWidth, refreshKey }: { page: string; containerWidth: number; refreshKey: number }) {
  function scaleFor(dev: DeviceDef): number {
    const slot = Math.max(containerWidth / 2 - 56, 100);
    const shellW = dev.type === 'laptop' ? dev.w + dev.bl + dev.br + BASE_EXTRA * 2 : dev.w + dev.bl + dev.br;
    return Math.min(slot / shellW, 0.3);
  }

  return (
    <div className="grid grid-cols-2 gap-8 place-items-center">
      {DEVICES.map(d => (
        <div key={d.id} className="flex flex-col items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <d.icon className="w-3.5 h-3.5" />
            {d.label}
            <span className="text-gray-400 font-normal">({d.w}×{d.h})</span>
          </span>
          <DeviceFrame dev={d} page={page} scale={scaleFor(d)} refreshKey={refreshKey} />
        </div>
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function DevicePreview() {
  const [deviceId,   setDeviceId]   = useState<string>('android');
  const [page,       setPage]       = useState<string>('/home');
  const [mode,       setMode]       = useState<'single' | 'compare'>('single');
  const [refreshKey, setRefreshKey] = useState(0);
  const [cw,         setCw]         = useState(800);  // container width

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(es => setCw(es[0]?.contentRect.width ?? 800));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const activeDev = DEVICES.find(d => d.id === deviceId) ?? DEVICES[0]!;

  const shellW    = activeDev.w + activeDev.bl + activeDev.br;
  const macOffset = activeDev.type === 'laptop' ? BASE_EXTRA * 2 : 0;
  const singleScale = Math.min((cw - 48) / (shellW + macOffset), 1);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div className="min-h-full bg-[#faf9ff]">
      {/* Controls bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#ede9f8] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
        {/* Page pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {PAGES.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPage(p.id)}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation"
              style={page === p.id
                ? { background: '#7C3AED', color: '#fff', border: '1.5px solid #7C3AED' }
                : { background: '#faf9ff', color: '#374151', border: '1.5px solid #e3ddf8' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Icon buttons */}
        <button
          type="button"
          onClick={refresh}
          title="Reload iframes"
          className="p-2 rounded-xl transition-colors touch-manipulation"
          style={{ border: '1.5px solid #e3ddf8', background: '#fff', color: '#6D4AE0' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <a
          href={page}
          target="_blank"
          rel="noopener noreferrer"
          title="Open page in new tab"
          className="p-2 rounded-xl transition-colors touch-manipulation"
          style={{ border: '1.5px solid #e3ddf8', background: '#fff', color: '#6D4AE0' }}
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        <button
          type="button"
          onClick={() => setMode(m => m === 'single' ? 'compare' : 'single')}
          title={mode === 'single' ? 'Compare all devices' : 'Single device'}
          className="p-2 rounded-xl transition-colors touch-manipulation"
          style={mode === 'compare'
            ? { border: '1.5px solid #7C3AED', background: '#f5f2fd', color: '#7C3AED' }
            : { border: '1.5px solid #e3ddf8', background: '#fff', color: '#6D4AE0' }
          }
        >
          {mode === 'compare'
            ? <Maximize2 className="w-4 h-4" />
            : <LayoutGrid className="w-4 h-4" />
          }
        </button>
      </div>

      <div ref={containerRef} className="p-4 sm:p-6">
        {mode === 'single' ? (
          <>
            {/* Device tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
              {DEVICES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeviceId(d.id)}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all touch-manipulation"
                  style={deviceId === d.id
                    ? { background: '#f5f2fd', border: '2px solid #6D4AE0', color: '#6D4AE0' }
                    : { background: '#fff', color: '#374151', border: '1.5px solid #e3ddf8' }
                  }
                >
                  <d.icon className="w-4 h-4" />
                  {d.label}
                </button>
              ))}
            </div>

            {/* Centred frame */}
            <div className="flex justify-center">
              <DeviceFrame
                dev={activeDev}
                page={page}
                scale={singleScale}
                refreshKey={refreshKey}
              />
            </div>

            {/* Info strip */}
            <p className="text-center text-xs text-gray-400 mt-4 space-x-2">
              <span>{activeDev.w} × {activeDev.h} px</span>
              <span>·</span>
              <span>{Math.round(singleScale * 100)}% scale</span>
              <span>·</span>
              <span>{activeDev.label}</span>
            </p>
          </>
        ) : (
          <CompareGrid page={page} containerWidth={cw} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
