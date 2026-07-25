'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink, LayoutGrid, Laptop, Maximize2,
  Monitor, RefreshCw, Smartphone, Tablet, ChevronDown,
} from 'lucide-react';

// ── Device catalogue ──────────────────────────────────────────────────────────

type DeviceType = 'phone' | 'tablet' | 'laptop';
type NotchKind  = 'android-pill' | 'dynamic-island' | 'camera-dot' | 'webcam-dot' | 'none';

interface DeviceDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  w: number;
  h: number;
  bt: number; br: number; bb: number; bl: number;
  radius: number;
  type: DeviceType;
  notch: NotchKind;
  shell: string;
}

const DEVICES: DeviceDef[] = [
  {
    id: 'android', label: 'Android', shortLabel: 'Android',
    icon: Smartphone,
    w: 393, h: 851, bt: 54, br: 14, bb: 46, bl: 14,
    radius: 46, type: 'phone', notch: 'android-pill', shell: '#1a1a2e',
  },
  {
    id: 'iphone', label: 'iPhone', shortLabel: 'iPhone',
    icon: Smartphone,
    w: 393, h: 852, bt: 54, br: 14, bb: 46, bl: 14,
    radius: 50, type: 'phone', notch: 'dynamic-island', shell: '#1c1c24',
  },
  {
    id: 'ipad', label: 'iPad', shortLabel: 'Tablet',
    icon: Tablet,
    w: 820, h: 1180, bt: 26, br: 22, bb: 26, bl: 22,
    radius: 22, type: 'tablet', notch: 'camera-dot', shell: '#2a2a38',
  },
  {
    id: 'macbook', label: 'MacBook', shortLabel: 'Desktop',
    icon: Laptop,
    w: 1280, h: 800, bt: 30, br: 18, bb: 18, bl: 18,
    radius: 10, type: 'laptop', notch: 'webcam-dot', shell: '#d2d2da',
  },
  {
    id: 'desktop', label: 'Desktop 1920', shortLabel: 'Full HD',
    icon: Monitor,
    w: 1920, h: 1080, bt: 28, br: 20, bb: 20, bl: 20,
    radius: 8, type: 'laptop', notch: 'webcam-dot', shell: '#2a2a38',
  },
];

const PAGES = [
  { id: '/home',     label: 'Dashboard' },
  { id: '/',         label: 'Landing' },
  { id: '/login',    label: 'Login' },
  { id: '/content',  label: 'Content' },
  { id: '/projects', label: 'Projects' },
  { id: '/publish',  label: 'Publish' },
  { id: '/insights', label: 'Insights' },
  { id: '/settings', label: 'Settings' },
];

const BASE_EXTRA = 20;
const BASE_H     = 54;

// ── Notch ─────────────────────────────────────────────────────────────────────

function Notch({ dev }: { dev: DeviceDef }) {
  const dot = dev.shell === '#d2d2da' || dev.shell === '#2a2a38' ? '#585868' : '#07070f';
  if (dev.notch === 'android-pill') return (
    <div style={{ position:'absolute', top:18, left:'50%', transform:'translateX(-50%)',
      width:90, height:24, borderRadius:12, background:dot }} />
  );
  if (dev.notch === 'dynamic-island') return (
    <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
      width:74, height:24, borderRadius:14, background:dot }} />
  );
  if (dev.notch === 'camera-dot') return (
    <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)',
      width:10, height:10, borderRadius:'50%', background:'#484858' }} />
  );
  if (dev.notch === 'webcam-dot') return (
    <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)',
      width:8, height:8, borderRadius:'50%', background:'#a0a0a8' }} />
  );
  return null;
}

// ── Device frame ──────────────────────────────────────────────────────────────

const DeviceFrame = memo(function DeviceFrame({
  dev, url, scale, refreshKey,
}: {
  dev: DeviceDef;
  url: string;
  scale: number;
  refreshKey: number;
}) {
  const isMac  = dev.type === 'laptop';
  const shellW = dev.w + dev.bl + dev.br;
  const shellH = dev.h + dev.bt + dev.bb;
  const outerW = isMac ? shellW + BASE_EXTRA * 2 : shellW;
  const outerH = isMac ? shellH + BASE_H : shellH;

  return (
    <div style={{ width: outerW * scale, height: outerH * scale, flexShrink: 0 }}>
      <div style={{ transformOrigin:'0 0', transform:`scale(${scale})`, width:outerW, height:outerH }}>
        <div style={{
          position:'relative', width:shellW, height:shellH,
          marginLeft: isMac ? BASE_EXTRA : 0,
          background: dev.shell, borderRadius: dev.radius,
          boxShadow: isMac
            ? '0 4px 20px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)'
            : '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.07) inset',
        }}>
          <Notch dev={dev} />
          <div style={{
            position:'absolute', top:dev.bt, left:dev.bl,
            width:dev.w, height:dev.h, overflow:'hidden',
            borderRadius: isMac ? 4 : Math.max(2, dev.radius - 14),
            background:'#111',
          }}>
            <iframe
              key={`${refreshKey}::${url}`}
              src={url}
              title={`${dev.label} preview`}
              style={{ width:dev.w, height:dev.h, border:'none', display:'block' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
            />
          </div>
        </div>
        {isMac && (
          <>
            <div style={{ marginLeft:BASE_EXTRA, width:shellW, height:4, background:'#b4b4bc' }} />
            <div style={{
              width:outerW, height:BASE_H - 4,
              background: dev.shell === '#d2d2da' ? '#c6c6ce' : '#222232',
              borderRadius:'0 0 14px 14px',
              display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:10,
            }}>
              <div style={{ width:190, height:28, background: dev.shell === '#d2d2da' ? '#b4b4bc' : '#333348', borderRadius:6 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ── Compare grid ──────────────────────────────────────────────────────────────

function CompareGrid({ url, containerWidth, refreshKey }: { url:string; containerWidth:number; refreshKey:number }) {
  function scaleFor(dev: DeviceDef) {
    const slot = Math.max(containerWidth / 2 - 56, 100);
    const shellW = dev.type === 'laptop' ? dev.w + dev.bl + dev.br + BASE_EXTRA * 2 : dev.w + dev.bl + dev.br;
    return Math.min(slot / shellW, 0.3);
  }
  return (
    <div className="grid grid-cols-2 gap-8 place-items-center">
      {DEVICES.filter(d => ['android', 'iphone', 'ipad', 'macbook'].includes(d.id)).map(d => (
        <div key={d.id} className="flex flex-col items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <d.icon className="w-3.5 h-3.5" />
            {d.label}
            <span className="text-gray-400 font-normal">({d.w}×{d.h})</span>
          </span>
          <DeviceFrame dev={d} url={url} scale={scaleFor(d)} refreshKey={refreshKey} />
        </div>
      ))}
    </div>
  );
}

// ── Floating bottom toolbar (Emergent-style) ──────────────────────────────────
// NOTE: This component must be rendered OUTSIDE any overflow-auto ancestor so
// that the device-switcher dropdown is never clipped. See DevicePreview layout.

function BottomToolbar({
  activeDev, devices, onSwitch, scale, onRefresh, onCompare, onOpen, page, compareMode,
}: {
  activeDev: DeviceDef;
  devices: DeviceDef[];
  onSwitch: (id: string) => void;
  scale: number;
  onRefresh: () => void;
  onCompare: () => void;
  onOpen: () => void;
  page: string;
  compareMode: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu when clicking outside
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  return (
    // No absolute positioning here — parent row handles centering
    <div ref={wrapRef} className="relative flex items-center gap-0 rounded-2xl overflow-visible shadow-2xl"
      style={{ background:'rgba(30,27,46,0.92)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)' }}>

      {/* Refresh */}
      <button type="button" onClick={onRefresh} title="Reload"
        className="flex items-center justify-center w-10 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-l-2xl"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.12)', flexShrink:0 }} />

      {/* Device switcher — dropdown opens UPWARD, never clipped because parent has overflow:visible */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-2 px-4 h-10 text-white hover:bg-white/10 transition-colors"
        >
          <activeDev.icon className="w-4 h-4 text-white/70" />
          <span className="text-sm font-semibold">{activeDev.shortLabel} view</span>
          <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-2xl shadow-2xl min-w-[200px] overflow-hidden"
            style={{ background:'rgba(24,22,40,0.97)', border:'1px solid rgba(255,255,255,0.14)', zIndex:50 }}
          >
            {devices.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onSwitch(d.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
                style={{
                  color: d.id === activeDev.id ? '#a78bfa' : 'rgba(255,255,255,0.85)',
                  fontWeight: d.id === activeDev.id ? 700 : 400,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <d.icon className="w-4 h-4 shrink-0" />
                <span>{d.label}</span>
                {d.id === activeDev.id && (
                  <span className="ml-auto text-[10px] font-bold tracking-wide" style={{ color:'#a78bfa' }}>ACTIVE</span>
                )}
                {d.id !== activeDev.id && (
                  <span className="ml-auto text-xs text-white/30">{d.w}px</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.12)', flexShrink:0 }} />

      {/* Compare all devices */}
      <button type="button" onClick={onCompare} title={compareMode ? 'Single view' : 'Compare all'}
        className="flex items-center justify-center w-10 h-10 hover:bg-white/10 transition-colors"
        style={{ color: compareMode ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}
      >
        {compareMode ? <Maximize2 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
      </button>

      {/* Open in new tab */}
      <a href={page} target="_blank" rel="noopener noreferrer" title="Open in new tab"
        className="flex items-center justify-center w-10 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
      </a>

      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.12)', flexShrink:0 }} />

      {/* Scale readout */}
      <span className="px-3 text-xs text-white/40 font-mono select-none rounded-r-2xl">{Math.round(scale * 100)}%</span>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function DevicePreview() {
  const [deviceId,    setDeviceId]   = useState('android');
  const [page,        setPage]       = useState('/home');
  const [mode,        setMode]       = useState<'single'|'compare'>('single');
  const [refreshKey,  setRefreshKey] = useState(0);
  const [cw,          setCw]         = useState(800);
  const [origin,      setOrigin]     = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve absolute origin so iframe src is always absolute (avoids about:blank edge-cases)
  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(es => setCw(es[0]?.contentRect.width ?? 800));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const activeDev  = DEVICES.find(d => d.id === deviceId) ?? DEVICES[0]!;
  const shellW     = activeDev.w + activeDev.bl + activeDev.br;
  const macOffset  = activeDev.type === 'laptop' ? BASE_EXTRA * 2 : 0;
  const macH       = activeDev.type === 'laptop' ? BASE_H : 0;
  const shellH     = activeDev.h + activeDev.bt + activeDev.bb;
  const frameH     = (shellH + macH) + 80; // +80 for bottom toolbar clearance
  const singleScale = Math.min((cw - 48) / (shellW + macOffset), 1);
  const url        = origin ? origin + page : page;

  const refresh    = useCallback(() => setRefreshKey(k => k + 1), []);
  const toggleMode = useCallback(() => setMode(m => m === 'single' ? 'compare' : 'single'), []);

  return (
    <div className="min-h-full bg-[#faf9ff] flex flex-col">
      {/* Page selector bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#ede9f8] px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {PAGES.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation"
            style={page === p.id
              ? { background:'#7C3AED', color:'#fff', border:'1.5px solid #7C3AED' }
              : { background:'#faf9ff', color:'#374151', border:'1.5px solid #e3ddf8' }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Preview + toolbar — flex column so toolbar is OUTSIDE the overflow-auto area.
          This is critical: keeping BottomToolbar inside overflow-auto clips its dropdown. */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scrollable device preview */}
        <div ref={containerRef} className="flex-1 relative overflow-auto p-6" style={{ minHeight: frameH * singleScale + 40 }}>
          {mode === 'single' ? (
            <div className="flex justify-center items-start">
              <DeviceFrame
                dev={activeDev}
                url={url}
                scale={singleScale}
                refreshKey={refreshKey}
              />
            </div>
          ) : (
            <CompareGrid url={url} containerWidth={cw} refreshKey={refreshKey} />
          )}
        </div>

        {/* Toolbar row — sibling to the scroll container, never clipped */}
        <div className="relative flex justify-center items-center py-3 bg-[#faf9ff] border-t border-[#ede9f8] shrink-0">
          <BottomToolbar
            activeDev={activeDev}
            devices={DEVICES}
            onSwitch={setDeviceId}
            scale={singleScale}
            onRefresh={refresh}
            onCompare={toggleMode}
            onOpen={() => window.open(url, '_blank')}
            page={page}
            compareMode={mode === 'compare'}
          />
        </div>
      </div>
    </div>
  );
}
