import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { BrandLogo } from '../components/BrandLogo';

interface AuthPageProps {
  mode: 'login' | 'register' | 'forgot';
}

function formatAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Enable Email/Password). Please use Google Sign-In or enable Email/Password in Firebase Console.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters.';
  }
  return msg;
}

export function AuthPage({ mode }: AuthPageProps) {
  const { user, signInWithGoogle, loginWithEmail, registerWithEmail, sendResetEmail } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'login' | 'register' | 'forgot'>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (user) {
    return <Navigate to="/feed" replace />;
  }

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/feed');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (viewMode === 'login') {
        await loginWithEmail(email, password);
        navigate('/feed');
      } else if (viewMode === 'register') {
        if (!settings.features.registrationEnabled) {
          throw new Error('New registrations are currently paused by the administrator.');
        }
        await registerWithEmail(email, password, displayName, username);
        setSuccessMsg('Account created! Please check your email inbox for the verification link.');
      } else {
        await sendResetEmail(email);
        setSuccessMsg('Password reset link sent to your email address.');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <BrandLogo />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-5">
              {viewMode === 'login'
                ? 'Welcome back'
                : viewMode === 'register'
                ? 'Create your account'
                : 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {viewMode === 'login'
                ? `Sign in to continue to ${settings.siteName}`
                : viewMode === 'register'
                ? `Join ${settings.siteName} — ${settings.tagline}`
                : 'Enter your email and we will send a password reset link.'}
            </p>
          </div>

          {viewMode === 'register' && !settings.features.registrationEnabled ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-900 dark:text-amber-200">
              New member registrations are temporarily paused by the platform administrator.
            </div>
          ) : (
            <>
              {viewMode !== 'forgot' && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleGoogle()}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span>or with email</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {viewMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Rivera"
                        maxLength={60}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Unique Username
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="alex.rivera"
                        maxLength={30}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>

                {viewMode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      {viewMode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode('forgot');
                            setError('');
                            setSuccessMsg('');
                          }}
                          className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                    />
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                    <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {viewMode === 'login'
                    ? 'Sign In'
                    : viewMode === 'register'
                    ? 'Create Account'
                    : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
            {viewMode === 'login' ? (
              <>
                New to {settings.siteName}?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('register');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
