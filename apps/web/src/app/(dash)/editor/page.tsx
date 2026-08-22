'use client';
import { Suspense, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Film,
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  Pencil,
  Download,
  Image as ImageIcon,
  Music,
  Video,
  FileVideo,
  CheckCircle2,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { api, type EditProject } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SceneCard {
  id: number;
  sceneNumber: number;
  duration: string;
  scriptExcerpt: string;
  gradient: string;
}

interface AssetItem {
  id: number;
  name: string;
  type: 'image' | 'audio' | 'video';
  size: string;
  duration?: string;
  gradient: string;
}

type ExportFormat = 'MP4' | 'WebM' | 'MOV';
type ExportQuality = '720p' | '1080p' | '4K';
type ExportFPS = '24fps' | '30fps' | '60fps';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SCENES: SceneCard[] = [
  {
    id: 1,
    sceneNumber: 1,
    duration: '0:32',
    scriptExcerpt: 'Welcome to the channel! Today we\'re diving deep into AI tools that will transform your workflow.',
    gradient: 'linear-gradient(135deg, #1a0845, #4c1d95)',
  },
  {
    id: 2,
    sceneNumber: 2,
    duration: '1:15',
    scriptExcerpt: 'First up is the content research phase — here\'s how we use AI to find trending topics before anyone else.',
    gradient: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
  },
  {
    id: 3,
    sceneNumber: 3,
    duration: '2:08',
    scriptExcerpt: 'Now let\'s talk about scripting. The AI doesn\'t write your video — it helps you think faster and structure ideas.',
    gradient: 'linear-gradient(135deg, #0d1f12, #14532d)',
  },
  {
    id: 4,
    sceneNumber: 4,
    duration: '1:44',
    scriptExcerpt: 'Thumbnail generation is where we save the most time. Four concepts in under 60 seconds — let me show you.',
    gradient: 'linear-gradient(135deg, #1c0a00, #7c2d12)',
  },
  {
    id: 5,
    sceneNumber: 5,
    duration: '2:55',
    scriptExcerpt: 'Editing workflow: batch cuts, auto-captions, B-roll suggestions. This is the part most creators underestimate.',
    gradient: 'linear-gradient(135deg, #0c0a1e, #312e81)',
  },
  {
    id: 6,
    sceneNumber: 6,
    duration: '0:48',
    scriptExcerpt: 'Final CTA and outro. Consistency beats perfection — see you next Tuesday with the SEO deep dive.',
    gradient: 'linear-gradient(135deg, #1a0a2e, #6b21a8)',
  },
];

const MOCK_ASSETS: AssetItem[] = [
  {
    id: 1,
    name: 'hero-thumbnail-v3.png',
    type: 'image',
    size: '2.4 MB',
    gradient: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
  },
  {
    id: 2,
    name: 'background-lo-fi.mp3',
    type: 'audio',
    size: '8.1 MB',
    duration: '3:22',
    gradient: 'linear-gradient(135deg, #065f46, #059669)',
  },
  {
    id: 3,
    name: 'b-roll-desk-setup.mp4',
    type: 'video',
    size: '312 MB',
    duration: '0:45',
    gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
  },
  {
    id: 4,
    name: 'channel-logo-anim.png',
    type: 'image',
    size: '0.9 MB',
    gradient: 'linear-gradient(135deg, #7c2d12, #ea580c)',
  },
  {
    id: 5,
    name: 'intro-jingle.mp3',
    type: 'audio',
    size: '1.2 MB',
    duration: '0:08',
    gradient: 'linear-gradient(135deg, #14532d, #16a34a)',
  },
  {
    id: 6,
    name: 'screen-recording-demo.mp4',
    type: 'video',
    size: '540 MB',
    duration: '4:12',
    gradient: 'linear-gradient(135deg, #312e81, #6366f1)',
  },
];

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

function assetIcon(type: AssetItem['type']) {
  if (type === 'image') return <ImageIcon className="w-4 h-4 text-purple-400" />;
  if (type === 'audio') return <Music className="w-4 h-4 text-green-400" />;
  return <Video className="w-4 h-4 text-blue-400" />;
}

function assetBadgeClass(type: AssetItem['type']): string {
  if (type === 'image') return 'bg-purple-100 text-purple-700';
  if (type === 'audio') return 'bg-green-100 text-green-700';
  return 'bg-blue-100 text-blue-700';
}

// ── Tab: Timeline Editor (project list) ───────────────────────────────────────

function TimelineEditorTab() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading, error } = useQuery<EditProject[]>({
    queryKey: ['editor-projects'],
    queryFn: () => api.editor.listMine().then((r) => r.data),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.editor.createBlank({ title: title || 'Untitled Edit' }).then((r) => r.data),
    onSuccess: (data) => {
      router.push(`/editor/${data.id}`);
    },
  });

  const handleCreate = () => {
    if (creating) return;
    setCreating(true);
    createMutation.mutate(newTitle || 'Untitled Edit');
  };

  return (
    <div className="space-y-5 p-5 lg:p-6">
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-gray-900">Recent Projects</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New edit
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-3">New edit project</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowForm(false);
              }}
              placeholder="Edit title (e.g. My YouTube Video)"
              className="bg-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all flex-1 border border-gray-200"
            />
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-xl text-gray-600 text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {(createMutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to create edit'}
            </p>
          )}
        </div>
      )}

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
          <Film className="w-10 h-10 mx-auto mb-3 text-purple-300" />
          <p className="mb-4">No edit projects yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition-colors"
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
                <Film className="w-5 h-5 shrink-0 text-purple-600" />
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
  const [hoveredScene, setHoveredScene] = useState<number | null>(null);

  return (
    <div className="p-5 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold text-gray-900">Scene Breakdown</p>
        <span className="text-xs text-gray-500">{MOCK_SCENES.length} scenes · 9:22 total</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_SCENES.map((scene) => (
          <div
            key={scene.id}
            className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all overflow-hidden cursor-pointer"
            onMouseEnter={() => setHoveredScene(scene.id)}
            onMouseLeave={() => setHoveredScene(null)}
          >
            {/* Thumbnail */}
            <div
              className="relative h-28 flex items-center justify-center"
              style={{ background: scene.gradient }}
            >
              {/* Scene number badge — top left */}
              <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold border border-white/30 backdrop-blur-sm">
                {scene.sceneNumber}
              </span>
              {/* Duration badge — bottom right */}
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
                {scene.duration}
              </span>
              {/* Film icon placeholder */}
              <FileVideo className="w-8 h-8 text-white/30" />
              {/* Hover overlay */}
              {hoveredScene === scene.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors">
                    <Pencil className="w-3 h-3" /> Edit Scene
                  </button>
                </div>
              )}
            </div>
            {/* Script excerpt */}
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Scene {scene.sceneNumber}</p>
              <p className="text-sm text-gray-600 leading-snug line-clamp-2">{scene.scriptExcerpt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Assets ───────────────────────────────────────────────────────────────

function AssetsTab() {
  return (
    <div className="p-5 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold text-gray-900">Project Assets</p>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors">
          <Upload className="w-3.5 h-3.5" /> Upload Asset
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_ASSETS.map((asset) => (
          <div
            key={asset.id}
            className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all overflow-hidden"
          >
            {/* Visual preview */}
            <div
              className="h-24 flex items-center justify-center relative"
              style={{ background: asset.gradient }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                {asset.type === 'audio' ? (
                  // Waveform placeholder
                  <div className="flex items-end gap-0.5 h-6 px-1">
                    {[40, 70, 55, 90, 60, 35, 75, 50, 80].map((h, i) => (
                      <div
                        key={i}
                        className="bg-white/70 rounded-sm w-1"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  assetIcon(asset.type)
                )}
              </div>
              {/* Type badge */}
              <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold capitalize ${assetBadgeClass(asset.type)}`}>
                {asset.type}
              </span>
            </div>
            {/* Info */}
            <div className="p-3">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{asset.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{asset.size}</span>
                {asset.duration && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">{asset.duration}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
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

      {/* Format */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Format</label>
        <div className="flex gap-2">
          {formats.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                format === f
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Quality</label>
        <div className="flex gap-2">
          {qualities.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                quality === q
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Frame rate */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Frame Rate</label>
        <div className="flex gap-2">
          {frameRates.map((r) => (
            <button
              key={r}
              onClick={() => setFps(r)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                fps === r
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
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

      {/* Progress bar (mock 0%) */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Export progress</span>
          <span>0%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-purple-600 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>

      {/* Export button */}
      <button className="w-full py-3.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
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
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5 pt-5 lg:pt-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
            >
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 leading-tight">Video Editor</h2>
              <p className="text-sm text-gray-400 mt-0.5">Timeline editing, storyboard &amp; multi-platform export</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4" /> Import Video
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition-colors">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {/* Tab card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none px-1 pt-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-all mr-0.5 ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {activeTab === 'timeline' && <TimelineEditorTab />}
          {activeTab === 'storyboard' && <StoryboardTab />}
          {activeTab === 'assets' && <AssetsTab />}
          {activeTab === 'export' && <ExportTab />}
        </div>

      </div>
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
