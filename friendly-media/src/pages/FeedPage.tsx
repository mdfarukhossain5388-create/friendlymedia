import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { Post } from '../types';
import { AdsterraSlot } from '../components/AdsterraSlot';
import { MainLayout } from '../components/MainLayout';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';

type FeedTab = 'latest' | 'following' | 'trending';

export function FeedPage() {
  const { user, privateInfo } = useAuth();
  const { adPlacements } = useSiteSettings();
  const navigate = useNavigate();

  const [tab, setTab] = useState<FeedTab>('latest');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pageLimit, setPageLimit] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFollowingIds(new Set());
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFollowingIds(new Set(snap.docs.map((d) => String(d.data().followingId))));
      },
      () => setFollowingIds(new Set())
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(pageLimit)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const blocked = new Set(privateInfo?.blockedUserIds || []);
        const items = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Post, 'id'>),
          }))
          .filter((p) => !blocked.has(p.authorId));
        setPosts(items);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'posts');
      }
    );
    return () => unsub();
  }, [pageLimit, privateInfo?.blockedUserIds]);

  const displayedPosts = React.useMemo(() => {
    if (tab === 'following' && user) {
      return posts.filter((p) => followingIds.has(p.authorId) || p.authorId === user.uid);
    }
    if (tab === 'trending') {
      return [...posts].sort(
        (a, b) =>
          b.likesCount + b.commentsCount * 2 + b.sharesCount * 3 -
          (a.likesCount + a.commentsCount * 2 + a.sharesCount * 3)
      );
    }
    return posts;
  }, [followingIds, posts, tab, user]);

  const betweenPostsConfig = adPlacements.find(
    (ad) => ad.enabled && ad.placement === 'between_posts'
  );
  const adFrequency = betweenPostsConfig?.frequency || 4;

  return (
    <MainLayout>
      <div className="space-y-5">
        <AdsterraSlot placement="news_feed" />

        {user && <PostComposer />}

        {/* Feed Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          {(['latest', 'following', 'trending'] as FeedTab[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                tab === mode
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {mode === 'latest' ? 'Latest Feed' : mode === 'following' ? 'Following' : 'Trending'}
            </button>
          ))}
        </div>

        {/* Feed Stream */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : displayedPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {tab === 'following'
                ? 'Your Following feed is quiet'
                : 'No posts published yet'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {tab === 'following'
                ? 'Follow creators from Suggested People or Explore to see their updates here.'
                : 'Share the very first post above to start the conversation.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post, idx) => (
              <React.Fragment key={post.id}>
                <PostCard
                  post={post}
                  onHashtagClick={(tag) => navigate(`/explore?tag=${encodeURIComponent(tag)}`)}
                />
                {betweenPostsConfig && (idx + 1) % adFrequency === 0 && (
                  <AdsterraSlot placement="between_posts" />
                )}
              </React.Fragment>
            ))}

            {posts.length >= pageLimit && (
              <button
                type="button"
                onClick={() => setPageLimit((prev) => prev + 15)}
                className="w-full py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Load More Posts
              </button>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
