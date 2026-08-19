'use client';
import { useState } from 'react';
import { Volume2, Mic2 } from 'lucide-react';
import AudioStudioPage from '@/app/(dash)/studio/audio/page';
import VoiceLibraryPage from '@/app/(dash)/studio/voices/page';

type SubTab = 'audio' | 'voice';

export function AudioStudioContent() {
  const [activeTab, setActiveTab] = useState<SubTab>('audio');

  return (
    <div>
      {/* Sub-tab strip */}
      <div className="px-5 pt-5 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div
          className="inline-flex items-center gap-1 rounded-2xl p-[3px]"
          style={{
            background: '#f0edf9',
            border: '1.5px solid #e3ddf8',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
            style={
              activeTab === 'audio'
                ? {
                    background: 'linear-gradient(135deg,#a78bfa,#7C3AED)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(124,58,237,.35)',
                  }
                : {
                    background: 'transparent',
                    color: '#6b6880',
                  }
            }
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            Audio Tools
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
            style={
              activeTab === 'voice'
                ? {
                    background: 'linear-gradient(135deg,#a78bfa,#7C3AED)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(124,58,237,.35)',
                  }
                : {
                    background: 'transparent',
                    color: '#6b6880',
                  }
            }
          >
            <Mic2 className="w-4 h-4 shrink-0" />
            Voice Library
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'audio' ? <AudioStudioPage /> : <VoiceLibraryPage />}
    </div>
  );
}
