'use client';
import { useState } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { ImageAssetBrowser } from '@/components/image-asset-browser';
import { ThumbnailGenerator } from '@/components/thumbnail-generator';

const TABS = [
  { id: 'images', label: 'Image Library', icon: ImageIcon },
  { id: 'thumbnail', label: 'AI Thumbnail', icon: Sparkles },
] as const;
type TabId = typeof TABS[number]['id'];

export default function AssetsStudioPage() {
  const [tab, setTab] = useState<TabId>('images');
  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-5 h-5" style={{ color: '#6D4AE0' }} />
            <h1 className="text-2xl font-extrabold text-gray-900">Assets Studio</h1>
          </div>
          <p className="text-sm text-gray-500">Royalty-free images from Pexels, Unsplash, Pixabay &amp; Openverse — plus AI thumbnail generation</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f0edf9', width: 'fit-content' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === id
                ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' }
                : { color: '#9b8fc4' }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'images' && <ImageAssetBrowser />}
        {tab === 'thumbnail' && <ThumbnailGenerator />}
      </div>
    </div>
  );
}
