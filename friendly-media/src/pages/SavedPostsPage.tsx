import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Post } from '../types';
import { MainLayout } from '../components/MainLayout';
import { PostCard } from '../components/PostCard';

export function SavedPostsPage() {
  const { user, privateInfo, loading } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const ids = privateInfo?.savedPostIds || [];
    if (!ids.length) {
      setSavedPosts([]);
      setFetching(false);
      return;
    }

    let active = true;
    const load = async () => {
      setFetching(true);
      const docs = await Promise.all(ids.map((id) => getDoc(doc(db, 'posts', id))));
      if (!active) return;
      const valid = docs
        .filter((d) => d.exists())
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }));
      setSavedPosts(valid);
      setFetching(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [privateInfo?.savedPostIds]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Saved Posts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Posts you bookmarked for quick reference.
          </p>
        </div>

        {fetching ? (
          <div className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : savedPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
            No saved posts yet. Tap the bookmark button on any post to save it here.
          </div>
        ) : (
          savedPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </MainLayout>
  );
}
