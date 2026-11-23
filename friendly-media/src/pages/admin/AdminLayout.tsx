import React, { useState } from 'react';
import { Link, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Palette,
  Settings,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../contexts/SiteSettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BrandLogo } from '../../components/BrandLogo';

export function AdminLoginPage() {
  const { user, adminRole, signInWithGoogle, loginWithEmail, logout, loading } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user && adminRole) {
    return <Navigate to="/admin" replace />;
  }

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <Link
            to="/"
            className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Public Site
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
            Administrator Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Restricted access for {settings.siteName} Super Admins, Admins, Moderators, and Support Staff.
          </p>
        </div>

        {user && !adminRole && !loading ? (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800 text-xs text-amber-200 space-y-3">
            <p>
              Signed in as <strong>{user.email}</strong>, which does not currently hold a staff role in the{' '}
              <code>admins</code> registry.
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-3.5 py-2 rounded-xl bg-amber-600 text-white font-semibold cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              Continue with Authorized Google Account
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              <span>or staff email sign-in</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Staff email address"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Authenticate Staff Session
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, adminRole, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !adminRole) {
    return <Navigate to="/admin/login" replace />;
  }

  const isAdminOrSuper = adminRole.role === 'super_admin' || adminRole.role === 'admin';

  const links = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/content', label: 'Content & Reports', icon: FileText },
    ...(isAdminOrSuper
      ? [
          { to: '/admin/adsterra', label: 'Adsterra Settings', icon: Megaphone },
          { to: '/admin/monetization', label: 'Monetization', icon: BarChart3 },
          { to: '/admin/customization', label: 'Website Design', icon: Palette },
          { to: '/admin/settings', label: 'General Settings', icon: Sliders },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:flex flex-col">
        <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Link to="/admin">
            <BrandLogo size="sm" />
          </Link>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{user.email}</p>
          <p className="text-slate-500 capitalize mt-0.5">
            Role: {adminRole.role.replace('_', ' ')}
          </p>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{l.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <Link
            to="/feed"
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Platform
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-slate-400">Admin</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <Link
              to="/admin/settings"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Mobile Admin Nav */}
        <div className="md:hidden overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 flex gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <main className="p-4 sm:p-8 max-w-6xl w-full mx-auto flex-1">{children}</main>
      </div>
    </div>
  );
}
