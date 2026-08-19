'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Loader2, Image as ImageIcon, Video, Play, Grid3X3,
  Heart, MessageCircle, Share2, ExternalLink, RefreshCw, Film,
} from 'lucide-react';

export interface PlatformPost {
  id: string;
  type: 'photo' | 'video' | 'reel' | 'carousel' | 'text';
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  metrics: { likes?: number; comments?: number; shares?: number; views?: number };
}

interface MediaPageResult {
  items: PlatformPost[];
  nextCursor: string | null;
  platformId: string;
  accountName?: string;
}

type FilterTab = 'all' | 'photo' | 'video' | 'reel' | 'carousel';

const TABS: { key: FilterTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all',      label: 'All',      icon: Grid3X3  },
  { key: 'photo',    label: 'Photos',   icon: ImageIcon },
  { key: 'video',    label: 'Videos',   icon: Video    },
  { key: 'reel',     label: 'Reels',    icon: Film     },
  { key: 'carousel', label: 'Albums',   icon: Grid3X3  },
];

function fmt(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function MediaCard({ post }: { post: PlatformPost }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative bg-gray-100 rounded-xl overflow-hidden aspect-square flex flex-col hover:ring-2 hover:ring-brand-400 transition-all"
    >
      {/* Thumbnail */}
      {post.thumbnailUrl && !imgErr ? (
        <img
          src={post.thumbnailUrl}
          alt={post.caption ?? 'Post'}
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          {post.type === 'video' || post.type === 'reel'
            ? <Video className="w-8 h-8 text-gray-400" />
            : <ImageIcon className="w-8 h-8 text-gray-400" />}
        </div>
      )}

      {/* Type badge */}
      {(post.type === 'video' || post.type === 'reel') && (
        <div className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
          <Play className="w-3 h-3 fill-white" />
        </div>
      )}
      {post.type === 'carousel' && (
        <div className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
          <Grid3X3 className="w-3 h-3" />
        </div>
      )}
      {post.type === 'reel' && (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          REEL
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-3 text-white text-xs font-medium">
          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(post.metrics.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{fmt(post.metrics.comments)}</span>
          {post.metrics.shares != null && (
            <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" />{fmt(post.metrics.shares)}</span>
          )}
          <ExternalLink className="w-3.5 h-3.5 ml-auto" />
        </div>
        {post.caption && (
          <p className="text-white text-[11px] mt-1 line-clamp-2 leading-tight">{post.caption}</p>
        )}
        <p className="text-white/70 text-[10px] mt-0.5">{timeAgo(post.timestamp)}</p>
      </div>
    </a>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

interface SocialMediaFeedProps {
  platformId: string;
  availableTabs?: FilterTab[];
}

export function SocialMediaFeed({ platformId, availableTabs }: SocialMediaFeedProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const tabs = TABS.filter((t) => !availableTabs || availableTabs.includes(t.key));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery<MediaPageResult>({
    queryKey: ['platform-media', platformId, activeTab],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<MediaPageResult>(`/platforms/${platformId}/media`, {
          params: { type: activeTab, limit: 12, cursor: pageParam ?? undefined },
        })
        .then((r) => r.data),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: 1,
  });

  const allPosts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {isFetching && !isFetchingNextPage ? (
        <SkeletonGrid />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <p className="text-sm text-gray-500">Could not load media. The access token may need refreshing.</p>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : allPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <ImageIcon className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500">No {activeTab === 'all' ? '' : activeTab + ' '}posts found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {allPosts.map((post) => (
              <MediaCard key={post.id} post={post} />
            ))}
          </div>

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
