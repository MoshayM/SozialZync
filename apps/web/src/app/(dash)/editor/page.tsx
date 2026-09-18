'use client';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Film,
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  Pencil,
  Download,
  Upload,
  Link2,
  Layers,
  FolderOpen,
  Music,
  ImageIcon,
  FileText,
  X,
  CheckCircle2,
} from 'lucide-react';
import { api, type EditProject } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExportFormat = 'MP4' | 'WebM' | 'MOV';
type ExportQuality = '720p' | '1080p' | '4K';
type ExportFPS = '24fps' | '30fps' | '60fps';
type ImportPhase = 'idle' | 'importing' | 'done';

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  DRAFT:     { background: '#f3f4f6', color: '#4b5563' },
  RENDERING: { background: '#eff6ff', color: '#1d4ed8' },
  READY:     { background: '#ecfdf5', color: '#065f46' },
  FAILED:    { background: '#fef2f2', color: '#b91c1c' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (editId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCreate() {
    const t = title.trim();
    if (!t || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { data: edit } = await api.editor.createBlank({ title: t });
      onCreated(edit.id);
    } catch (err) {
      setError(getErrorMessage(err));
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New edit project"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">New project</h2>
              <p className="text-xs text-gray-400 mt-0.5">Name your edit project to get started</p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
            placeholder="e.g. YouTube Tutorial, Product Demo"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 transition"
          />

          {error && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!title.trim() || creating}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-gray-800 transition-colors"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create &amp; Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Picker Panel (post-import) ────────────────────────────────────────

function ProjectPickerPanel({
  assetId,
  projectId,
  filename,
  onDismiss,
}: {
  assetId: string;
  projectId: string;
  filename: string;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [newTitle, setNewTitle] = useState('');
  const [existingProjects, setExistingProjects] = useState<EditProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingProjects(true);
    api.editor.listMine()
      .then((r) => setExistingProjects(r.data))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  const canOpen = mode === 'new' ? true : !!selectedId;
  const baseName = filename.replace(/\.[^.]+$/, '');

  async function handleOpen() {
    setOpening(true);
    setError(null);
    try {
      if (mode === 'new') {
        const title = newTitle.trim() || baseName;
        const { data: edit } = await api.editor.create(projectId, {
          sourceKind: 'ASSET',
          sourceId: assetId,
          title,
        });
        router.push(`/editor/${edit.id}`);
      } else if (selectedId) {
        router.push(`/editor/${selectedId}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setOpening(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
      {/* Success header */}
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-900">Video ready!</p>
          <p className="text-xs text-emerald-700 truncate mt-0.5">{filename}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl border border-emerald-200 overflow-hidden text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`flex-1 py-2 transition-colors ${mode === 'new' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
        >
          New project
        </button>
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={`flex-1 py-2 transition-colors border-l border-emerald-200 ${mode === 'existing' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
        >
          Existing project
        </button>
      </div>

      {/* New project: name input */}
      {mode === 'new' && (
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleOpen(); }}
          placeholder={`e.g. "${baseName}"`}
          className="w-full border border-emerald-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 transition"
        />
      )}

      {/* Existing project list */}
      {mode === 'existing' && (
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {loadingProjects ? (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5 py-2 px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : existingProjects.length === 0 ? (
            <p className="text-sm text-emerald-700 py-2 px-1">No projects yet — use &quot;New project&quot; above.</p>
          ) : (
            existingProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                  selectedId === p.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-emerald-100 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                <Film className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{p.title}</span>
                {selectedId === p.id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => void handleOpen()}
        disabled={opening || !canOpen}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
        Edit this video →
      </button>
    </div>
  );
}

// ── Tab: Timeline Editor (project list) ───────────────────────────────────────

function TimelineEditorTab({ onNewProject }: { onNewProject: () => void }) {
  const { data: projects = [], isLoading, error } = useQuery<EditProject[]>({
    queryKey: ['editor-projects'],
    queryFn: () => api.editor.listMine().then((r) => r.data),
    retry: false,
  });

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <p className="text-sm font-bold text-gray-900">Recent Projects</p>

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading edit projects…
        </div>
      )}

      {!!error && !isLoading && (
        <div className="py-16 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Could not load edit projects. Create a new one to get started.</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <Film className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="mb-4">No edit projects yet.</p>
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-gray-600 hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create your first edit
          </button>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/editor/${p.id}`}
              className="block bg-white rounded-2xl px-5 py-4 hover:shadow-lg transition-all border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 shrink-0 text-gray-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {relativeTime(p.lastEditedAt)} · {p.width}×{p.height} · {p.fps}fps
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                  style={STATUS_STYLES[p.status] ?? { background: '#f3f4f6', color: '#4b5563' }}
                >
                  {p.status.toLowerCase()}
                </span>
                <Pencil className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Storyboard ───────────────────────────────────────────────────────────

function StoryboardTab() {
  return (
    <div className="p-5 lg:p-6">
      <p className="text-sm font-bold text-gray-900 mb-5">Scene Breakdown</p>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' }}>
          <Layers className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-base font-semibold text-gray-800 mb-1">No scenes yet</p>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          AI will generate your script scenes here. Open an edit project and run a Script job to begin.
        </p>
      </div>
    </div>
  );
}

// ── Tab: Assets ───────────────────────────────────────────────────────────────

type LocalAsset = { file: File; id: string };

function assetIcon(file: File) {
  if (file.type.startsWith('video/')) return <Film className="w-4 h-4 text-blue-500 shrink-0" />;
  if (file.type.startsWith('audio/')) return <Music className="w-4 h-4 text-purple-500 shrink-0" />;
  if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-green-500 shrink-0" />;
  return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetsTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<LocalAsset[]>([]);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const next: LocalAsset[] = files.map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }));
    setAssets((prev) => [...prev, ...next]);
    e.target.value = '';
  }

  function remove(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="p-5 lg:p-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*,.pdf,.txt,.srt,.vtt"
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold text-gray-900">Project Assets</p>
        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 active:scale-[0.97] transition-all"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Asset
        </button>
      </div>

      {assets.length > 0 ? (
        <div className="flex flex-col gap-2">
          {assets.map(({ file, id }) => (
            <div
              key={id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-white"
            >
              {assetIcon(file)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                Local
              </span>
              <button
                type="button"
                aria-label="Remove asset"
                onClick={() => remove(id)}
                className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={openPicker}
            className="flex items-center justify-center gap-1.5 mt-1 py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add more files
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' }}>
            <FolderOpen className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-800 mb-1">No assets yet</p>
          <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-5">
            Generated thumbnails, audio, and video files will appear here once your AI jobs complete.
          </p>
          <button
            type="button"
            onClick={openPicker}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <Upload className="w-4 h-4" /> Upload your first asset
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Export ───────────────────────────────────────────────────────────────

function ExportTab() {
  const [format, setFormat] = useState<ExportFormat>('MP4');
  const [quality, setQuality] = useState<ExportQuality>('1080p');
  const [fps, setFps] = useState<ExportFPS>('30fps');

  const formats: ExportFormat[] = ['MP4', 'WebM', 'MOV'];
  const qualities: ExportQuality[] = ['720p', '1080p', '4K'];
  const frameRates: ExportFPS[] = ['24fps', '30fps', '60fps'];

  return (
    <div className="p-5 lg:p-6 max-w-lg mx-auto">
      <p className="text-sm font-bold text-gray-900 mb-6">Export Settings</p>

      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Format</label>
        <div className="flex gap-2">
          {formats.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                format === f
                  ? 'bg-gray-600 text-white border-gray-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Quality</label>
        <div className="flex gap-2">
          {qualities.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                quality === q
                  ? 'bg-gray-600 text-white border-gray-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Frame Rate</label>
        <div className="flex gap-2">
          {frameRates.map((r) => (
            <button
              key={r}
              onClick={() => setFps(r)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                fps === r
                  ? 'bg-gray-600 text-white border-gray-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-2">Export Summary</p>
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>Format</span>
          <span className="font-semibold">{format}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-700 mt-1">
          <span>Resolution</span>
          <span className="font-semibold">{quality}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-700 mt-1">
          <span>Frame Rate</span>
          <span className="font-semibold">{fps}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-700 mt-1">
          <span>Estimated size</span>
          <span className="font-semibold text-gray-400">~2.1 GB</span>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Export progress</span>
          <span>0%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-600 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>

      <button className="w-full py-3.5 rounded-xl bg-gray-600 text-white text-sm font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
        <Download className="w-4 h-4" />
        Export Video
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">Exports are processed in the background. You&#39;ll be notified when ready.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'timeline' | 'storyboard' | 'assets' | 'export';

interface TabDef {
  key: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: 'timeline', label: 'Timeline Editor' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'assets', label: 'Assets' },
  { key: 'export', label: 'Export' },
];

function EditorInner() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const importRef = useRef<HTMLInputElement>(null);

  // New Project modal
  const [showNewProject, setShowNewProject] = useState(false);

  // Upload/URL import state machine
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importLabel, setImportLabel] = useState('');
  const [importedAsset, setImportedAsset] = useState<{
    assetId: string;
    projectId: string;
    filename: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // URL input
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  const importing = importPhase === 'importing';

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowUrlInput(false);
    setImportLabel(file.name);
    setImportPhase('importing');
    setImportError(null);
    try {
      const { data } = await api.media.uploadVideo(file);
      setImportedAsset({ assetId: data.assetId, projectId: data.projectId, filename: data.filename || file.name });
      setImportPhase('done');
    } catch (err) {
      setImportError(getErrorMessage(err));
      setImportPhase('idle');
    }
  }

  async function handleUrlImport() {
    const url = urlValue.trim();
    if (!url) return;
    setShowUrlInput(false);
    setUrlValue('');
    const label = url.split('/').pop()?.split('?')[0] || 'video';
    setImportLabel(label);
    setImportPhase('importing');
    setImportError(null);
    try {
      const { data } = await api.media.importVideoFromUrl(url);
      setImportedAsset({ assetId: data.assetId, projectId: data.projectId, filename: data.filename || label });
      setImportPhase('done');
    } catch (err) {
      setImportError(getErrorMessage(err));
      setImportPhase('idle');
    }
  }

  function dismissImport() {
    setImportPhase('idle');
    setImportedAsset(null);
    setImportError(null);
  }

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5 pt-5 lg:pt-6">

        {/* Page header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
            >
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 leading-tight">Video Editor</h2>
              <p className="text-sm text-gray-400 mt-0.5">Timeline editing, storyboard &amp; multi-platform export</p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/*"
              className="hidden"
              onChange={handleFileImport}
            />

            {/* Upload File */}
            <button
              type="button"
              onClick={() => { setShowUrlInput(false); setImportError(null); importRef.current?.click(); }}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload File
            </button>

            {/* From URL */}
            <button
              type="button"
              onClick={() => { setShowUrlInput((v) => !v); setImportError(null); }}
              disabled={importing}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold active:scale-[.98] transition-all disabled:opacity-50 ${showUrlInput ? 'border-gray-600 bg-gray-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Link2 className="w-4 h-4" /> From URL
            </button>

            {/* New Project — opens naming modal */}
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold bg-gray-700 hover:bg-gray-800 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>

          {/* URL input row */}
          {showUrlInput && (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleUrlImport(); }}
                placeholder="https://example.com/video.mp4"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void handleUrlImport()}
                disabled={!urlValue.trim() || importing}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold bg-gray-700 hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Import
              </button>
              <button type="button" onClick={() => setShowUrlInput(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Import in-progress indicator */}
          {importing && (
            <div className="flex items-center gap-2.5 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
              <span>
                Importing <span className="font-medium text-gray-700 max-w-xs truncate">{importLabel}</span>…
              </span>
            </div>
          )}

          {/* Project picker — shown once upload/import succeeds */}
          {importPhase === 'done' && importedAsset && (
            <ProjectPickerPanel
              assetId={importedAsset.assetId}
              projectId={importedAsset.projectId}
              filename={importedAsset.filename}
              onDismiss={dismissImport}
            />
          )}

          {/* Import error */}
          {importError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {importError}
            </p>
          )}
        </div>

        {/* Tab card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-100 px-1 pt-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-all mr-0.5 shrink-0 ${
                  activeTab === tab.key
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'timeline' && <TimelineEditorTab onNewProject={() => setShowNewProject(true)} />}
          {activeTab === 'storyboard' && <StoryboardTab />}
          {activeTab === 'assets' && <AssetsTab />}
          {activeTab === 'export' && <ExportTab />}
        </div>

      </div>

      {/* New Project modal — rendered outside main scroll area */}
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={(id) => router.push(`/editor/${id}`)}
        />
      )}
    </div>
  );
}

export default function EditorListPage() {
  return (
    <Suspense fallback={null}>
      <EditorInner />
    </Suspense>
  );
}
