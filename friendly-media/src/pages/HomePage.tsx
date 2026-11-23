import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Globe, MessageSquare, ShieldCheck, Video } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { BRAND_ASSETS } from '../utils/media';
import { BrandLogo } from '../components/BrandLogo';

export function HomePage() {
  const { user, loading } = useAuth();
  const { settings } = useSiteSettings();
  const { theme, toggleTheme } = useTheme();

  if (!loading && user) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <BrandLogo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link to="/explore" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Explore
            </Link>
            <Link to="/trending" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Trending
            </Link>
            <Link to="/videos" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Videos
            </Link>
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <Link
              to="/login"
              style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white hover:opacity-95 whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center">
          <p className="text-xs font-semibold tracking-wider text-blue-700 dark:text-blue-400 uppercase mb-3">
            {settings.tagline}
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12] [text-wrap:balance]">
            {settings.heroHeadline}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            {settings.heroSubheadline}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {settings.features.registrationEnabled && (
              <Link
                to="/register"
                style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-95 shadow-sm whitespace-nowrap"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Browse Public Feed
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="h-full min-h-[320px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-slate-200 dark:bg-slate-800">
            <img
              src={BRAND_ASSETS.heroCommunity}
              alt="International creators collaborating in a sunlit studio on FRIENDLY MEDIA"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Globe className="w-6 h-6 text-blue-700 dark:text-blue-400 mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Global News Feed</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Publish multi-photo stories, #hashtags, and reactions with granular public or private visibility.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Video className="w-6 h-6 text-teal-700 dark:text-teal-400 mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Creator Video Hub</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Stream full-screen videos with custom thumbnails, view counters, and threaded discussions.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <MessageSquare className="w-6 h-6 text-blue-700 dark:text-blue-400 mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Real-Time Messaging</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Instant direct messaging with photo sharing, typing indicators, online presence, and read receipts.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-6 h-6 text-teal-700 dark:text-teal-400 mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Privacy First</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Isolated private account records, user blocking, reporting tools, and verified community profiles.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial Showcase Split */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[4/3] bg-slate-200 dark:bg-slate-800">
          <img
            src={BRAND_ASSETS.editorialPhoto}
            alt="Global cities connected through FRIENDLY MEDIA"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
            Designed for creators, built for communities worldwide
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {settings.aboutContent}
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/about"
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Read Our Story
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Contact Team
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>{settings.footerText}</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white">About Us</Link>
            <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Contact Us</Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms & Conditions</Link>
            <Link to="/admin/login" className="hover:text-slate-900 dark:hover:text-white">Admin Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
