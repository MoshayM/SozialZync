'use client';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  Pencil,
  Upload,
  Link2,
  X,
  CheckCircle2,
  Trash2,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { api, type EditProject } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportPhase = 'idle' | 'importing' | 'done';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: '#f3f4f6', text: '#4b5563' },
  RENDERING: { bg: '#eff6ff', text: '#1d4ed8' },
  READY:     { bg: '#ecfdf5', text: '#065f46' },
  FAILED:    { bg: '#fef2f2', text: '#b91c1c' },
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
      .then((r) => setExistingProjects(r.data ?? []))
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

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({
  project,
  onCancel,
  onConfirm,
  deleting,
}: {
  project: EditProject;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete project"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Delete project?</h2>
            <p className="text-xs text-gray-400 truncate max-w-[220px] mt-0.5">{project.title}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          This will permanently delete the edit project and its timeline. Your source media files will not be affected.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDelete,
}: {
  project: EditProject;
  onDelete: (p: EditProject) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS['DRAFT'];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setGroupOpen(false); }}
    >
      {/* Thumbnail area — 16:9 */}
      <div className="relative w-full bg-gray-900" style={{ paddingTop: '56.25%' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-12 h-12 text-gray-700" />
        </div>

        {/* Specs badge */}
        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-gray-400 bg-gray-900/70 rounded px-1.5 py-0.5 backdrop-blur-sm">
          {project.width}×{project.height} · {project.fps}fps
        </div>

        {/* Hover action overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ background: 'rgba(0,0,0,0.62)' }}
        >
          {/* Edit */}
          <Link
            href={`/editor/${project.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white border border-white/25 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDelete(project); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-200 border border-red-300/30 bg-red-500/20 hover:bg-red-500/40 transition-colors backdrop-blur-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>

          {/* Group — dropdown anchor */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setGroupOpen((o) => !o); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 border border-white/20 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <Layers className="w-3.5 h-3.5" /> Group <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {groupOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10">
                <p className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Organize</p>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setGroupOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-400" /> Add to collection
                  <span className="ml-auto text-[10px] text-gray-300">soon</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setGroupOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Film className="w-3.5 h-3.5 text-gray-400" /> Move to project
                  <span className="ml-auto text-[10px] text-gray-300">soon</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{project.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-[11px] text-gray-400">{relativeTime(project.lastEditedAt)}</span>
          <span
            className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: sc.bg, color: sc.text }}
          >
            {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── New-project card (+ tile) ─────────────────────────────────────────────────

function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50 transition-all flex flex-col items-center justify-center min-h-[180px] cursor-pointer"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
        style={{ background: 'linear-gradient(135deg,#374151,#1f2937)' }}
      >
        <Plus className="w-6 h-6 text-white" />
      </div>
      <p className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">New Project</p>
      <p className="text-[11px] text-gray-400 mt-0.5">Start a blank timeline</p>
    </button>
  );
}

// ── Project grid ──────────────────────────────────────────────────────────────

function ProjectGrid({ onNewProject }: { onNewProject: () => void }) {
  const qc = useQueryClient();
  const { data: rawProjects, isLoading, error } = useQuery<EditProject[]>({
    queryKey: ['editor-projects'],
    queryFn: () => api.editor.listMine().then((r) => r.data ?? []),
    retry: false,
  });

  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  const [pendingDelete, setPendingDelete] = useState<EditProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.editor.deleteProject(pendingDelete.id);
      void qc.invalidateQueries({ queryKey: ['editor-projects'] });
      setPendingDelete(null);
    } catch {
      // error stays visible via the dialog
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading projects…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <AlertCircle className="w-8 h-8 mb-3 text-gray-300" />
        <p className="text-sm">Could not load projects.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <NewProjectCard onClick={onNewProject} />
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onDelete={setPendingDelete} />
        ))}
      </div>

      {projects.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-6">
          No projects yet — click <strong className="text-gray-600">New Project</strong> or import a video to get started.
        </p>
      )}

      {pendingDelete && (
        <DeleteConfirmDialog
          project={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
          deleting={deleting}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function EditorInner() {
  const router = useRouter();
  const importRef = useRef<HTMLInputElement>(null);

  const [showNewProject, setShowNewProject] = useState(false);

  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importLabel, setImportLabel] = useState('');
  const [importedAsset, setImportedAsset] = useState<{
    assetId: string;
    projectId: string;
    filename: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
      <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-6 pt-5 lg:pt-6">

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
              <p className="text-sm text-gray-400 mt-0.5">Timeline editing &amp; multi-platform export</p>
            </div>
          </div>

          {/* Import actions */}
          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/*"
              className="hidden"
              onChange={handleFileImport}
            />

            <button
              type="button"
              onClick={() => { setShowUrlInput(false); setImportError(null); importRef.current?.click(); }}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload File
            </button>

            <button
              type="button"
              onClick={() => { setShowUrlInput((v) => !v); setImportError(null); }}
              disabled={importing}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold active:scale-[.98] transition-all disabled:opacity-50 ${showUrlInput ? 'border-gray-600 bg-gray-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Link2 className="w-4 h-4" /> From URL
            </button>
          </div>

          {/* URL input */}
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

          {/* Import progress */}
          {importing && (
            <div className="flex items-center gap-2.5 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
              <span>
                Importing <span className="font-medium text-gray-700 max-w-xs truncate">{importLabel}</span>…
              </span>
            </div>
          )}

          {/* Project picker after import */}
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

        {/* Projects grid */}
        <ProjectGrid onNewProject={() => setShowNewProject(true)} />

      </div>

      {/* New project modal */}
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
