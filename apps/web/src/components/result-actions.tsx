'use client';
import { useState, useCallback } from 'react';
import { Copy, Check, Download, Share2, Trash2, Save, Volume2, VolumeX, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';

interface ContentToolbarProps {
  /** Plain-text representation of the result to copy/download/share */
  text: string;
  /** Base filename (without extension) for the downloaded file */
  filename: string;
  /** Called when user clicks "New" / clear */
  onNew?: () => void;
  /** Whether a saved draft exists in localStorage (shows saved indicator) */
  savedAt?: string | null;
}

export function ContentToolbar({ text, filename, onNew, savedAt }: ContentToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  const handleDownload = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [text, filename]);

  const handleShare = useCallback(async () => {
    const shareData = { title: filename, text };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {}
    }
    await handleCopy();
  }, [filename, text, handleCopy]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {savedAt && (
        <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium mr-1">
          <Save className="w-3 h-3" /> Auto-saved {savedAt}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
        style={{ background: copied ? '#ecfdf5' : '#f5f2fd', color: copied ? '#065f46' : '#6D4AE0', border: `1.5px solid ${copied ? '#a7f3d0' : '#e3ddf8'}` }}
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
        style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}
        title="Download as text file"
      >
        <Download className="w-3.5 h-3.5" />
        Download
      </button>
      <button
        type="button"
        onClick={() => void handleShare()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
        style={{ background: shared ? '#ecfdf5' : '#f5f2fd', color: shared ? '#065f46' : '#6D4AE0', border: `1.5px solid ${shared ? '#a7f3d0' : '#e3ddf8'}` }}
        title="Share"
      >
        <Share2 className="w-3.5 h-3.5" />
        {shared ? 'Shared!' : 'Share'}
      </button>
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ml-auto"
          style={{ background: 'transparent', color: '#9ca3af', border: '1.5px solid #e5e7eb' }}
          title="Start new — clears current result"
        >
          <Trash2 className="w-3.5 h-3.5" />
          New
        </button>
      )}
    </div>
  );
}

// ── Claude-style action bar ───────────────────────────────────────────────────

export interface ResultActionBarProps {
  text: string;
  filename?: string;
  onRegenerate?: () => void;
}

export function ResultActionBar({ text, filename = 'result', onRegenerate }: ResultActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const handleReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [text, speaking]);

  const handleShare = useCallback(async () => {
    const shareData = { title: filename, text };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); return; } catch {}
    }
    await handleCopy();
  }, [filename, text, handleCopy]);

  const handleDownload = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [text, filename]);

  const base = 'w-8 h-8 rounded-full flex items-center justify-center transition-colors text-gray-400 hover:text-[#6D4AE0] hover:bg-[#f5f2fd]';
  const active = 'w-8 h-8 rounded-full flex items-center justify-center transition-colors text-[#6D4AE0] bg-[#f5f2fd]';

  return (
    <div className="border-t border-[#f0edfb] pt-2.5 mt-3 flex items-center gap-0.5">
      <button type="button" title="Copy" onClick={() => void handleCopy()} className={copied ? active : base}>
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button type="button" title={speaking ? 'Stop' : 'Read aloud'} onClick={handleReadAloud} className={speaking ? active : base}>
        {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
      <button type="button" title="Share" onClick={() => void handleShare()} className={base}>
        <Share2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" title="Download" onClick={handleDownload} className={base}>
        <Download className="w-3.5 h-3.5" />
      </button>
      {onRegenerate && (
        <button type="button" title="Regenerate" onClick={onRegenerate} className={base}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
      <span className="flex-1" />
      <button
        type="button"
        title="Good response"
        onClick={() => { setThumbsUp((v) => !v); setThumbsDown(false); }}
        className={thumbsUp ? active : base}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Bad response"
        onClick={() => { setThumbsDown((v) => !v); setThumbsUp(false); }}
        className={thumbsDown ? 'w-8 h-8 rounded-full flex items-center justify-center transition-colors text-red-500 bg-red-50' : base}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Backward-compat export
export function ResultActions({ data, filename }: { data: unknown; filename: string }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return <ContentToolbar text={text} filename={filename} />;
}
