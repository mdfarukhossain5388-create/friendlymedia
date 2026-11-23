import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Compass,
  Flame,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  User as UserIcon,
  Video,
  Wrench,
} from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Post, UserProfile } from '../types';
import { AdsterraSlot } from './AdsterraSlot';
import { Avatar } from './Avatar';
import { BrandLogo } from './BrandLogo';

interface MainLayoutProps {
  children: React.ReactNode;
  hideRightSidebar?: boolean;
}

export function MainLayout({ children, hideRightSidebar = false }: MainLayoutProps) {
  const { user, profile, adminRole, unreadNotifications, unreadMessages, logout, resendVerification, refreshAuth } =
    useAuth();
  const { settings } = useSiteSettings();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [verificationMsg, setVerificationMsg] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('accountStatus', '==', 'active'),
      limit(6)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => u.uid !== user?.uid);
        setSuggestedUsers(list.slice(0, 4));
      },
      () => setSuggestedUsers([])
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const tagCounts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as Post;
          (data.hashtags || []).forEach((tag) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        setTrendingTags(sorted);
      },
      () => setTrendingTags([])
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowedIds(new Set());
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFollowedIds(new Set(snap.docs.map((d) => String(d.data().followingId))));
      },
      () => setFollowedIds(new Set())
    );
    return () => unsub();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleQuickFollow = async (target: UserProfile) => {
    if (!user || !user.emailVerified || !profile) {
      navigate('/login');
      return;
    }
    const followId = `${user.uid}_${target.uid}`;
    if (followedIds.has(target.uid)) return;
    await setDoc(doc(db, 'follows', followId), {
      followerId: user.uid,
      followingId: target.uid,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', target.uid), {
      followersCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', user.uid), {
      followingCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  };

  // Maintenance mode gate for non-admin users
  if (settings.features.maintenanceMode && !adminRole && !location.pathname.startsWith('/admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6" />
          </div>
          <BrandLogo />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-4">
            Scheduled Platform Maintenance
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {settings.siteName} is undergoing a quick infrastructure upgrade. We will be back online shortly.
          </p>
          <Link
            to="/admin/login"
            className="inline-block mt-6 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
          >
            Administrator Sign In
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/feed', label: 'News Feed', icon: Home },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/trending', label: 'Trending', icon: Flame },
    { to: '/videos', label: 'Videos', icon: Video },
    ...(settings.features.messagingEnabled
      ? [{ to: '/messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages }]
      : []),
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { to: '/saved', label: 'Saved Posts', icon: Bookmark },
    ...(profile ? [{ to: `/profile/${profile.username}`, label: 'Profile', icon: UserIcon }] : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Announcement Banner */}
      {settings.announcementEnabled && settings.announcementBanner && (
        <div
          style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
          className="text-white text-xs sm:text-sm font-medium py-2 px-4 text-center"
        >
          {settings.announcementBanner}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 h-14 sm:h-16 border-b border-slate-200 dark:border-slate-800 ${
          settings.headerStyle === 'solid'
            ? 'bg-white dark:bg-slate-900'
            : 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-4">
          <Link to={user ? '/feed' : '/'} className="shrink-0">
            <BrandLogo size="sm" />
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people, posts, #hashtags, or videos..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <>
                <Link
                  to="/notifications"
                  className="relative w-10 h-10 rounded-xl hidden sm:flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Link>

                {adminRole && (
                  <Link
                    to="/admin"
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Admin
                  </Link>
                )}

                {profile && (
                  <Link
                    to={`/profile/${profile.username}`}
                    className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Avatar src={profile.avatarUrl} name={profile.displayName} size="xs" />
                    <span className="hidden md:inline text-xs font-semibold max-w-[110px] truncate">
                      {profile.displayName}
                    </span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void logout()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Sign In
                </Link>
                {settings.features.registrationEnabled && (
                  <Link
                    to="/register"
                    style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white hover:opacity-95 whitespace-nowrap"
                  >
                    Join Now
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Email Verification Gate Banner */}
      {user && !user.emailVerified && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span>
              Verify your email address ({user.email}) to unlock posting, messaging, and social interactions.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await resendVerification();
                  setVerificationMsg('Verification email sent!');
                }}
                className="px-3 py-1 rounded-lg bg-amber-900 text-white text-xs font-semibold cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={() => void refreshAuth()}
                className="px-3 py-1 rounded-lg border border-amber-700 text-xs font-semibold cursor-pointer"
              >
                I Verified
              </button>
              {verificationMsg && <span className="font-semibold">{verificationMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Adsterra Header Placement */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3">
        <AdsterraSlot placement="header" />
        <AdsterraSlot placement="mobile" className="md:hidden mt-2" />
      </div>

      {/* Main 3-Column Social Workspace */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 lg:pb-8">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-22 space-y-4">
            <nav className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-700 text-white text-[11px] font-bold tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}

              {adminRole && (
                <NavLink
                  to="/admin"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Admin Console</span>
                </NavLink>
              )}
            </nav>

            <div className="px-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <Link to="/about" className="hover:underline">About</Link>
              <Link to="/contact" className="hover:underline">Contact</Link>
              <Link to="/privacy" className="hover:underline">Privacy</Link>
              <Link to="/terms" className="hover:underline">Terms</Link>
            </div>
          </div>
        </aside>

        {/* Center Main Content */}
        <main className={hideRightSidebar ? 'lg:col-span-9 min-w-0' : 'lg:col-span-6 min-w-0'}>
          {children}
        </main>

        {/* Right Discovery Sidebar */}
        {!hideRightSidebar && (
          <aside className="hidden lg:block lg:col-span-3 space-y-5">
            <div className="sticky top-22 space-y-5">
              {/* Suggested Users */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Suggested People
                  </h2>
                  <Link
                    to="/explore"
                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {suggestedUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    New community profiles will appear here as members join.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {suggestedUsers.map((u) => {
                      const isFollowing = followedIds.has(u.uid);
                      return (
                        <div key={u.uid} className="flex items-center justify-between gap-2">
                          <Link
                            to={`/profile/${u.username}`}
                            className="flex items-center gap-2.5 min-w-0"
                          >
                            <Avatar src={u.avatarUrl} name={u.displayName} size="sm" verified={u.verified} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {u.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">@{u.username}</p>
                            </div>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleQuickFollow(u)}
                            disabled={isFollowing}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                              isFollowing
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90'
                            }`}
                          >
                            {isFollowing ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Trending Topics */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Trending Topics
                  </h2>
                  <Link
                    to="/trending"
                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    See more
                  </Link>
                </div>
                {trendingTags.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use #hashtags in your posts to start a trending topic.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trendingTags.map((item) => (
                      <Link
                        key={item.tag}
                        to={`/explore?tag=${encodeURIComponent(item.tag)}`}
                        className="py-2 flex items-center justify-between text-xs hover:text-blue-700 dark:hover:text-blue-400"
                      >
                        <span className="font-semibold">#{item.tag}</span>
                        <span className="text-slate-500 tabular-nums">{item.count} posts</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Adsterra Sidebar Placement */}
              <AdsterraSlot placement="sidebar" />
            </div>
          </aside>
        )}
      </div>

      {/* Footer + Adsterra Footer Placement */}
      <footer className="hidden lg:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-5 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <AdsterraSlot placement="footer" />
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>{settings.footerText}</p>
            <div className="flex items-center gap-4">
              <Link to="/about" className="hover:text-slate-900 dark:hover:text-white">About Us</Link>
              <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Contact Us</Link>
              <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Compact 56px to respect 15% sticky height cap) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center pb-safe">
        <NavLink
          to="/feed"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] ${
              isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Feed</span>
        </NavLink>
        <NavLink
          to="/explore"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] ${
              isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Explore</span>
        </NavLink>
        <NavLink
          to="/videos"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] ${
              isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <Video className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Videos</span>
        </NavLink>
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center min-h-[44px] ${
              isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Messages</span>
          {unreadMessages > 0 && (
            <span className="absolute top-1 right-4 w-2 h-2 rounded-full bg-red-600" />
          )}
        </NavLink>
        <NavLink
          to={profile ? `/profile/${profile.username}` : '/login'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] ${
              isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
