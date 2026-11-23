import React, { useRef, useState } from 'react';
import {
  Film,
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { PostMediaType, PostVisibility } from '../types';
import { extractHashtags, isSafeUrl } from '../utils/validation';
import { uploadImageAsset, uploadVideoAsset } from '../utils/media';
import { Avatar } from './Avatar';

interface PostComposerProps {
  defaultMode?: 'text' | 'image' | 'video';
  onPublished?: () => void;
}

export function PostComposer({ defaultMode = 'text', onPublished }: PostComposerProps) {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [mediaType, setMediaType] = useState<PostMediaType>(defaultMode);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  if (!user || !profile) return null;

  const isEmailVerified = user.emailVerified;

  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (imageUrls.length + files.length > 6) {
      setError('You can attach up to 6 photos per post.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const url = await uploadImageAsset(file, 'posts', user.uid);
        uploaded.push(url);
      }
      setImageUrls((prev) => [...prev, ...uploaded]);
      setMediaType('image');
      setVideoUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadVideoAsset(file, user.uid);
      setVideoUrl(url);
      setMediaType('video');
      setImageUrls([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleThumbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadImageAsset(file, 'thumbnails', user.uid);
      setVideoThumbnail(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailVerified) {
      setError('Please verify your email address before publishing posts.');
      return;
    }
    const cleanContent = content.trim();
    if (!cleanContent && imageUrls.length === 0 && !videoUrl.trim()) {
      setError('Write something, attach photos, or add a video to share.');
      return;
    }
    if (mediaType === 'video' && videoUrl.trim() && !isSafeUrl(videoUrl.trim())) {
      setError('Please provide a valid https:// video URL.');
      return;
    }

    setSubmitting(true);
    setError('');

    const resolvedMediaType: PostMediaType =
      videoUrl.trim() ? 'video' : imageUrls.length > 0 ? 'image' : 'text';
    const hashtags = extractHashtags(cleanContent);

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: profile.displayName,
        authorUsername: profile.username,
        authorAvatar: profile.avatarUrl || '',
        authorVerified: Boolean(profile.verified),
        content: cleanContent.slice(0, 5000),
        mediaType: resolvedMediaType,
        mediaUrls: resolvedMediaType === 'image' ? imageUrls : [],
        videoUrl: resolvedMediaType === 'video' ? videoUrl.trim() : '',
        videoThumbnail: resolvedMediaType === 'video' ? videoThumbnail.trim() : '',
        videoTitle: resolvedMediaType === 'video' ? videoTitle.trim().slice(0, 140) : '',
        hashtags,
        visibility,
        likesCount: 0,
        reactionsSummary: {},
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        isEdited: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user.uid), {
        postsCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      setContent('');
      setImageUrls([]);
      setVideoUrl('');
      setVideoTitle('');
      setVideoThumbnail('');
      setMediaType('text');
      onPublished?.();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs"
    >
      <div className="flex gap-3">
        <Avatar src={profile.avatarUrl} name={profile.displayName} verified={profile.verified} />
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Share something with the world, ${profile.displayName.split(' ')[0]}... Use #hashtags to join topics`}
            rows={3}
            maxLength={5000}
            className="w-full resize-none bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />

          {imageUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-slate-100 dark:bg-slate-800">
                  <img
                    src={url}
                    alt={`Attachment ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black cursor-pointer"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {mediaType === 'video' && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Video Attachment
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType('text');
                    setVideoUrl('');
                    setVideoTitle('');
                    setVideoThumbnail('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Remove video
                </button>
              </div>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Video title (optional)"
                maxLength={140}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste direct MP4/WebM URL or upload a file"
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3.5 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer"
                >
                  Upload Video
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {videoThumbnail ? 'Change Thumbnail' : 'Upload Thumbnail'}
                </button>
                {videoThumbnail && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Thumbnail attached</span>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-2.5 text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageFiles}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoFile}
                className="hidden"
              />
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleThumbFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Photos</span>
              </button>

              {settings.features.videoUploadsEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaType('video');
                    setImageUrls([]);
                  }}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Film className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Video</span>
                </button>
              )}

              <div className="relative inline-flex items-center">
                <select
                  aria-label="Post visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                  className="pl-7 pr-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
                <span className="pointer-events-none absolute left-2.5 text-slate-500">
                  {visibility === 'public' ? (
                    <Globe className="w-3.5 h-3.5" />
                  ) : visibility === 'followers' ? (
                    <Users className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              style={{ backgroundColor: settings.primaryColor || '#1d4ed8' }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-semibold hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
            >
              {submitting || uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{uploading ? 'Uploading...' : submitting ? 'Publishing...' : 'Publish'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
