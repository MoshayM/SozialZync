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

// ── Visible labeled pill action bar ──────────────────────────────────────────

export interface ResultActionBarProps {
  text: string;
  filename?: string;
  onRegenerate?: () => void;
}

export function ResultActionBar({ text, filename = 'result', onRegenerate }: ResultActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [liked, setLiked] = useState<'up' | 'down' | null>(null);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const handleReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, [text, speaking]);

  const handleShare = useCallback(async () => {
    const d = { title: filename, text };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(d)) {
      try { await navigator.share(d); return; } catch {}
    }
    await handleCopy();
  }, [filename, text, handleCopy]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }, [text, filename]);

  const pill = (active: boolean, accent?: string) => {
    const base = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border';
    if (active && accent === 'green') return `${base} bg-green-50 border-green-200 text-green-700`;
    if (active) return `${base} bg-[#f0edfb] border-[#c4b5f4] text-[#6D4AE0]`;
    return `${base} bg-white border-[#e3ddf8] text-gray-600 hover:bg-[#f5f2fd] hover:border-[#c4b5f4] hover:text-[#6D4AE0]`;
  };

  return (
    <div className="border-t border-[#f0edfb] pt-3 mt-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => void handleCopy()} className={pill(copied, 'green')} title="Copy to clipboard">
          {copied
            ? <><Check className="w-3.5 h-3.5" /><span>Copied!</span></>
            : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
        </button>

        <button type="button" onClick={handleReadAloud} className={pill(speaking)} title={speaking ? 'Stop reading' : 'Read aloud'}>
          {speaking
            ? <><VolumeX className="w-3.5 h-3.5" /><span>Stop</span></>
            : <><Volume2 className="w-3.5 h-3.5" /><span>Read Aloud</span></>}
        </button>

        <button type="button" onClick={() => void handleShare()} className={pill(false)} title="Share">
          <Share2 className="w-3.5 h-3.5" /><span>Share</span>
        </button>

        <button type="button" onClick={handleDownload} className={pill(false)} title="Download .txt">
          <Download className="w-3.5 h-3.5" /><span>Download</span>
        </button>

        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className={pill(false)} title="Regenerate answer">
            <RefreshCw className="w-3.5 h-3.5" /><span>Try Again</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLiked(l => l === 'up' ? null : 'up')}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border ${liked === 'up' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-[#e3ddf8] text-gray-400 hover:text-green-500 hover:border-green-200'}`}
            title="Good result"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLiked(l => l === 'down' ? null : 'down')}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border ${liked === 'down' ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-[#e3ddf8] text-gray-400 hover:text-red-400 hover:border-red-200'}`}
            title="Poor result"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Backward-compat export
export function ResultActions({ data, filename }: { data: unknown; filename: string }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return <ContentToolbar text={text} filename={filename} />;
}
