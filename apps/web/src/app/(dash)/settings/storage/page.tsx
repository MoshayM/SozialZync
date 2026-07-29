'use client';
import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Trash2, RefreshCw, FolderOpen, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface CategoryStats {
  category: string;
  label: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
  exists: boolean;
}

interface StorageStats {
  basePath: string;
  totalUsedBytes: number;
  categories: CategoryStats[];
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
}

function fmt(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

const CLEARABLE = ['images', 'videos', 'voices', 'music', 'cache'];

export default function StoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get<StorageStats>('/system/storage');
      setStats(r.data);
    } catch {
      setToast({ type: 'err', msg: 'Failed to load storage stats' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function clearCategory(cat: string) {
    setClearing(cat);
    try {
      await apiClient.delete(`/system/storage/${cat}`);
      setToast({ type: 'ok', msg: `Cleared ${cat} storage` });
      await load();
    } catch {
      setToast({ type: 'err', msg: `Failed to clear ${cat}` });
    } finally {
      setClearing(null);
    }
  }

  const diskPct = stats && stats.diskTotal > 0
    ? Math.round((stats.diskUsed / stats.diskTotal) * 100)
    : 0;

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: toast.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: toast.type === 'ok' ? '#16a34a' : '#dc2626', border: `1px solid ${toast.type === 'ok' ? '#bbf7d0' : '#fecaca'}` }}
        >
          {toast.msg}
          <button className="ml-3 opacity-60 hover:opacity-100" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Storage</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage local AI-generated files and models</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Disk overview */}
      {stats && (
        <div className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-5 h-5 text-[#6D4AE0]" />
            <div>
              <p className="text-sm font-bold text-gray-900">Disk Usage</p>
              <p className="text-xs text-gray-400">{diskPct}% used · {fmt(stats.diskFree)} free of {fmt(stats.diskTotal)}</p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${diskPct}%`, background: diskPct > 85 ? '#ef4444' : diskPct > 60 ? '#f59e0b' : '#6D4AE0' }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400 font-mono break-all">{stats.basePath}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Set <code className="bg-gray-50 px-1 rounded text-[11px]">STORAGE_BASE_PATH</code> env var to change location.
          </p>
        </div>
      )}

      {/* Categories */}
      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#6D4AE0] animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-700">Storage Categories</h2>
          {stats?.categories.map((cat) => {
            const pct = stats.totalUsedBytes > 0 ? Math.round((cat.sizeBytes / stats.totalUsedBytes) * 100) : 0;
            const canClear = CLEARABLE.includes(cat.category);
            return (
              <div
                key={cat.category}
                className="flex items-center gap-4 rounded-xl px-5 py-4"
                style={{ background: 'white', border: '1px solid #e5e7eb' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
                    <p className="text-xs text-gray-400">{fmt(cat.sizeBytes)} · {cat.fileCount} files</p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#6D4AE0] transition-all" style={{ width: `${pct}%`, opacity: cat.exists ? 1 : 0.3 }} />
                  </div>
                </div>
                {canClear && (
                  <button
                    onClick={() => void clearCategory(cat.category)}
                    disabled={!!clearing || cat.sizeBytes === 0}
                    title="Clear this category"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {clearing === cat.category ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Clear
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      {stats && (
        <div className="rounded-xl px-5 py-3 flex items-center justify-between" style={{ background: '#f5f2fd', border: '1px solid #d4c9f9' }}>
          <p className="text-sm font-bold text-gray-700">Total AI storage used</p>
          <p className="text-sm font-extrabold" style={{ color: '#6D4AE0' }}>{fmt(stats.totalUsedBytes)}</p>
        </div>
      )}
    </div>
  );
}
