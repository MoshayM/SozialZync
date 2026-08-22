'use client';
import { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Maximize2 } from 'lucide-react';

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function openFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen();
  }

  return (
    <div
      className="relative rounded-3xl overflow-hidden glow-ring select-none"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        <div className="flex-1 mx-3 h-5 rounded-md flex items-center px-3" style={{ background: 'rgba(255,255,255,.06)' }}>
          <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,.3)' }}>app.sozialzync.com</span>
        </div>
        {/* Mute toggle in chrome */}
        <button
          onClick={toggleMute}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-colors"
          style={{ color: muted ? 'rgba(255,255,255,.35)' : '#9ca3af', background: muted ? 'transparent' : 'rgba(156,163,175,.1)' }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          <span className="hidden sm:inline">{muted ? 'Unmute' : 'Muted'}</span>
        </button>
      </div>

      {/* Video */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src="/sozialzync-ad-30s.mp4"
          muted
          loop
          playsInline
          autoPlay
          className="w-full h-full object-cover"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {/* Overlay controls — shown on hover or when paused */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
          style={{ opacity: showControls || !playing ? 1 : 0, background: 'rgba(0,0,0,.12)' }}
        >
          {/* Centre play/pause */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm"
            style={{ background: 'rgba(55,65,81,.75)', border: '2px solid rgba(255,255,255,.25)' }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing
              ? <span className="flex gap-0.5"><span className="w-1.5 h-5 rounded-sm bg-white" /><span className="w-1.5 h-5 rounded-sm bg-white" /></span>
              : <Play className="w-6 h-6 text-white ml-0.5" fill="white" />}
          </button>
        </div>

        {/* Bottom bar */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 transition-opacity duration-200"
          style={{ opacity: showControls ? 1 : 0, background: 'linear-gradient(to top,rgba(0,0,0,.6),transparent)' }}
        >
          <span className="text-[10px] font-semibold text-white/70">Sozialzynk in 30 seconds</span>
          <button
            onClick={openFullscreen}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,.6)' }}
            aria-label="Full screen"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Full screen</span>
          </button>
        </div>
      </div>

      {/* "Muted — click to hear" nudge, fades after 3s */}
      {muted && playing && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold backdrop-blur-sm animate-fade-out"
            style={{ background: 'rgba(0,0,0,.55)', color: 'rgba(255,255,255,.75)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <VolumeX className="w-3 h-3" /> Click the speaker to hear
          </span>
        </div>
      )}
    </div>
  );
}
