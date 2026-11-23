import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Check, KeyRound, Loader2, Shield, Trash2 } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { MainLayout } from '../components/MainLayout';

export function SettingsPage() {
  const { user, profile, privateInfo, loading, sendResetEmail, deleteCurrentAccount } = useAuth();
  const { theme, setTheme } = useTheme();

  const [showOnlineStatus, setShowOnlineStatus] = useState(privateInfo?.showOnlineStatus ?? true);
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<'everyone' | 'following' | 'none'>(
    privateInfo?.allowMessagesFrom || 'everyone'
  );
  const [isPrivate, setIsPrivate] = useState(profile?.isPrivate ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        showOnlineStatus,
        allowMessagesFrom,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', user.uid), {
        isPrivate,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDelete !== 'DELETE') {
      setError('Type DELETE in capital letters to confirm permanent account deletion.');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await deleteCurrentAccount();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'For security, please sign out and sign back in right before deleting your account.'
      );
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            Account & Privacy Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Signed in as {privateInfo?.email || user?.email}
          </p>

          <form onSubmit={handleSavePrivacy} className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Appearance</p>
                <p className="text-xs text-slate-500">Choose light or dark mode interface</p>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                {(['light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                      theme === mode
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Private Account</p>
                <p className="text-xs text-slate-500">Limit profile discovery and default post audience</p>
              </div>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Show Online Status</p>
                <p className="text-xs text-slate-500">Let people you chat with see when you are active</p>
              </div>
              <input
                type="checkbox"
                checked={showOnlineStatus}
                onChange={(e) => setShowOnlineStatus(e.target.checked)}
                className="w-4 h-4"
              />
            </label>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Direct Messages</p>
                <p className="text-xs text-slate-500">Control who can initiate chats with you</p>
              </div>
              <select
                value={allowMessagesFrom}
                onChange={(e) =>
                  setAllowMessagesFrom(e.target.value as 'everyone' | 'following' | 'none')
                }
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                <option value="everyone">Everyone</option>
                <option value="following">People I follow</option>
                <option value="none">No one</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              {saved ? (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Preferences saved
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs sm:text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password Reset */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" />
              Password & Security
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a password reset email to {user?.email}.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!user?.email) return;
              await sendResetEmail(user.email);
              setResetSent(true);
            }}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {resetSent ? 'Reset Email Sent' : 'Send Password Reset Email'}
          </button>
        </div>

        {/* Account Deletion */}
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete Account
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Permanently remove your profile, username reservation, and private account record. Type{' '}
            <strong>DELETE</strong> below to confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE"
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
      </div>
    </MainLayout>
  );
}
