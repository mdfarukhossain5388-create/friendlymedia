import { useEffect, useState } from 'react';
import { Film, Flame } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { Post } from '../types';
import { AdsterraSlot } from '../components/AdsterraSlot';
import { MainLayout } from '../components/MainLayout';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';

export function VideosPage() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [videos, setVideos] = useState<Post[]>([]);
  const [sortMode, setSortMode] = useState<'latest' | 'trending'>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      where('mediaType', '==', 'video'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVideos(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Post, 'id'>),
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const ordered =
    sortMode === 'trending'
      ? [...videos].sort((a, b) => b.viewsCount + b.likesCount * 2 - (a.viewsCount + a.likesCount * 2))
      : videos;

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Video Discovery
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Stream creator videos, full-screen playback, views, likes, and discussions.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSortMode('latest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                sortMode === 'latest'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Latest
            </button>
            <button
              type="button"
              onClick={() => setSortMode('trending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                sortMode === 'trending'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Trending
            </button>
          </div>
        </div>

        <AdsterraSlot placement="video_page" />

        {user && settings.features.videoUploadsEnabled && <PostComposer defaultMode="video" />}

        {loading ? (
          <div className="h-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : ordered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">No videos shared yet</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Upload a video or paste a direct MP4/WebM URL above to publish to Video Discovery.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordered.map((videoPost) => (
              <PostCard key={videoPost.id} post={videoPost} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
