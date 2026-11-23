import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flame, Search, Users } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Post, UserProfile } from '../types';
import { Avatar } from '../components/Avatar';
import { MainLayout } from '../components/MainLayout';
import { PostCard } from '../components/PostCard';

interface ExplorePageProps {
  mode?: 'explore' | 'trending';
}

export function ExplorePage({ mode = 'explore' }: ExplorePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || searchParams.get('tag') || '';

  const [queryText, setQueryText] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'all' | 'people' | 'posts' | 'videos'>('all');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQueryText(searchParams.get('q') || searchParams.get('tag') || '');
  }, [searchParams]);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('accountStatus', '==', 'active'), limit(40)),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      },
      () => setUsers([])
    );

    const unsubPosts = onSnapshot(
      query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snap) => {
        setPosts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Post, 'id'>),
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubUsers();
      unsubPosts();
    };
  }, []);

  const qLower = queryText.trim().toLowerCase().replace(/^#/, '');

  const filteredUsers = useMemo(() => {
    if (!qLower) return users.slice(0, 8);
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(qLower) ||
        u.username.toLowerCase().includes(qLower) ||
        (u.bio || '').toLowerCase().includes(qLower)
    );
  }, [qLower, users]);

  const filteredPosts = useMemo(() => {
    let base = [...posts];
    if (mode === 'trending') {
      base.sort(
        (a, b) =>
          b.likesCount + b.commentsCount * 2 + b.sharesCount * 3 + b.viewsCount -
          (a.likesCount + a.commentsCount * 2 + a.sharesCount * 3 + a.viewsCount)
      );
    }
    if (activeFilter === 'videos') {
      base = base.filter((p) => p.mediaType === 'video');
    }
    if (!qLower) return base;
    return base.filter(
      (p) =>
        p.content.toLowerCase().includes(qLower) ||
        p.authorName.toLowerCase().includes(qLower) ||
        p.authorUsername.toLowerCase().includes(qLower) ||
        (p.videoTitle || '').toLowerCase().includes(qLower) ||
        (p.hashtags || []).some((t) => t.toLowerCase().includes(qLower))
    );
  }, [activeFilter, mode, posts, qLower]);

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {mode === 'trending' && <Flame className="w-5 h-5 text-amber-600" />}
                {mode === 'trending' ? 'Trending Across FRIENDLY MEDIA' : 'Explore & Search'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Discover people, @usernames, #hashtags, posts, and creator videos.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                if (e.target.value) {
                  setSearchParams({ q: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
              placeholder="Search people, @username, #hashtags, or posts..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['all', 'people', 'posts', 'videos'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                  activeFilter === f
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {(activeFilter === 'all' || activeFilter === 'people') && filteredUsers.length > 0 && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              People
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredUsers.map((u) => (
                <Link
                  key={u.uid}
                  to={`/profile/${u.username}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} verified={u.verified} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {u.displayName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {activeFilter !== 'people' && (
          <section className="space-y-4">
            {loading ? (
              <div className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ) : filteredPosts.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500">
                No matching posts found.
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onHashtagClick={(tag) => {
                    setQueryText(`#${tag}`);
                    setSearchParams({ tag });
                  }}
                />
              ))
            )}
          </section>
        )}
      </div>
    </MainLayout>
  );
}
