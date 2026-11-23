import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, Check, Loader2 } from 'lucide-react';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BRAND_ASSETS, uploadImageAsset } from '../utils/media';
import { isSafeUrl, isValidUsername, normalizeUsername } from '../utils/validation';
import { Avatar } from '../components/Avatar';
import { MainLayout } from '../components/MainLayout';

export function EditProfilePage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setAvatarUrl(profile.avatarUrl || '');
      setCoverUrl(profile.coverUrl || '');
      setIsPrivate(Boolean(profile.isPrivate));
    }
  }, [profile]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImageAsset(file, 'avatars', user.uid);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImageAsset(file, 'covers', user.uid);
      setCoverUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload cover photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const cleanUsername = normalizeUsername(username);
    if (!isValidUsername(cleanUsername)) {
      setError('Username must be 3–30 characters using lowercase letters, numbers, dots, or underscores.');
      return;
    }
    if (website.trim() && !isSafeUrl(website.trim())) {
      setError('Website URL must start with https:// or http://.');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      if (cleanUsername !== profile.username) {
        const snap = await getDoc(doc(db, 'usernames', cleanUsername));
        if (snap.exists() && snap.data().uid !== user.uid) {
          setError('That username is already taken.');
          setSaving(false);
          return;
        }
        await setDoc(doc(db, 'usernames', cleanUsername), {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
        await deleteDoc(doc(db, 'usernames', profile.username));
      }

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim().slice(0, 60),
        username: cleanUsername,
        bio: bio.trim().slice(0, 300),
        location: location.trim().slice(0, 80),
        website: website.trim().slice(0, 200),
        avatarUrl,
        coverUrl,
        isPrivate,
        updatedAt: serverTimestamp(),
      });

      setSaved(true);
      setTimeout(() => navigate(`/profile/${cleanUsername}`), 600);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="relative h-40 bg-slate-200 dark:bg-slate-800">
          <img
            src={coverUrl || BRAND_ASSETS.defaultCover}
            alt="Profile cover preview"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={uploading}
            className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-black cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            Change Cover
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadCover}
            className="hidden"
          />
        </div>

        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-4 -mt-12 relative z-10">
            <div className="p-1 rounded-full bg-white dark:bg-slate-900">
              <Avatar src={avatarUrl} name={displayName || 'User'} size="xl" />
            </div>
            <div className="pt-8">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {uploading ? 'Uploading...' : 'Change Photo'}
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadAvatar}
                className="hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Bio
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Location
              </label>
              <input
                type="text"
                maxLength={80}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Website
              </label>
              <input
                type="url"
                maxLength={200}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Make profile private by default</span>
          </label>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          {saved && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" /> Profile updated!
            </p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2 rounded-xl bg-blue-700 text-white text-xs sm:text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
