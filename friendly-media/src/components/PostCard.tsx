import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Edit3,
  Eye,
  Flag,
  Heart,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { Post, PostComment, PostVisibility, ReactionType } from '../types';
import { isSafeUrl } from '../utils/validation';
import { Avatar } from './Avatar';

interface PostCardProps {
  post: Post;
  onHashtagClick?: (tag: string) => void;
}

const REACTIONS: { type: ReactionType; label: string; emoji: string }[] = [
  { type: 'like', label: 'Like', emoji: '👍' },
  { type: 'love', label: 'Love', emoji: '❤️' },
  { type: 'haha', label: 'Haha', emoji: '😄' },
  { type: 'wow', label: 'Wow', emoji: '😮' },
  { type: 'insight', label: 'Insightful', emoji: '💡' },
];

export function formatRelativeTime(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return 'Just now';
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return ts.toDate().toLocaleDateString();
}

export function PostCard({ post, onHashtagClick }: PostCardProps) {
  const { user, profile, privateInfo, adminRole } = useAuth();
  const { settings } = useSiteSettings();

  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [showReactionTray, setShowReactionTray] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editVisibility, setEditVisibility] = useState<PostVisibility>(post.visibility);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or misleading');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const isAuthor = user?.uid === post.authorId;
  const isStaffMod = Boolean(adminRole && ['super_admin', 'admin', 'moderator'].includes(adminRole.role));
  const isSaved = Boolean(privateInfo?.savedPostIds?.includes(post.id));

  useEffect(() => {
    if (!user) {
      setMyReaction(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'posts', post.id, 'reactions', user.uid),
      (snap) => {
        if (snap.exists()) {
          setMyReaction((snap.data().type as ReactionType) || 'like');
        } else {
          setMyReaction(null);
        }
      },
      () => setMyReaction(null)
    );
    return () => unsub();
  }, [post.id, user]);

  useEffect(() => {
    if (!showComments) return;
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PostComment, 'id'>),
          }))
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `posts/${post.id}/comments`);
      }
    );
    return () => unsub();
  }, [post.id, showComments]);

  const handleReact = async (type: ReactionType) => {
    if (!user || !user.emailVerified || !settings.features.reactionsEnabled) return;
    setShowReactionTray(false);
    const reactionRef = doc(db, 'posts', post.id, 'reactions', user.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      if (myReaction === type) {
        await deleteDoc(reactionRef);
        await updateDoc(postRef, {
          likesCount: increment(-1),
          [`reactionsSummary.${type}`]: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } else if (myReaction) {
        const previous = myReaction;
        await updateDoc(reactionRef, { type });
        await updateDoc(postRef, {
          [`reactionsSummary.${previous}`]: increment(-1),
          [`reactionsSummary.${type}`]: increment(1),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(reactionRef, {
          postId: post.id,
          postAuthorId: post.authorId,
          postVisibility: post.visibility,
          userId: user.uid,
          type,
          createdAt: serverTimestamp(),
        });
        await updateDoc(postRef, {
          likesCount: increment(1),
          [`reactionsSummary.${type}`]: increment(1),
          updatedAt: serverTimestamp(),
        });
        if (post.authorId !== user.uid && profile) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: post.authorId,
            actorId: user.uid,
            actorName: profile.displayName,
            actorUsername: profile.username,
            actorAvatar: profile.avatarUrl || '',
            type: 'like',
            targetId: post.id,
            message: `${profile.displayName} reacted (${type}) to your post.`,
            isRead: false,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/reactions`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified || !profile || !commentText.trim()) return;
    const text = commentText.trim().slice(0, 1000);
    setCommentText('');

    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        postAuthorId: post.authorId,
        postVisibility: post.visibility,
        authorId: user.uid,
        authorName: profile.displayName,
        authorUsername: profile.username,
        authorAvatar: profile.avatarUrl || '',
        content: text,
        parentCommentId: replyTo ? replyTo.id : '',
        likesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      const notifyRecipient = replyTo ? replyTo.authorId : post.authorId;
      if (notifyRecipient !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: notifyRecipient,
          actorId: user.uid,
          actorName: profile.displayName,
          actorUsername: profile.username,
          actorAvatar: profile.avatarUrl || '',
          type: replyTo ? 'reply' : 'comment',
          targetId: post.id,
          message: replyTo
            ? `${profile.displayName} replied to your comment.`
            : `${profile.displayName} commented on your post.`,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }
      setReplyTo(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}/comments`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}/comments/${commentId}`);
    }
  };

  const handleToggleSave = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        savedPostIds: isSaved ? arrayRemove(post.id) : arrayUnion(post.id),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/private/info`);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/explore?post=${post.id}`;
      await navigator.clipboard?.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      if (user && user.emailVerified) {
        await updateDoc(doc(db, 'posts', post.id), {
          sharesCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Clipboard fallback silently ignored
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: editContent.trim().slice(0, 5000),
        visibility: editVisibility,
        isEdited: true,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleDeletePost = async () => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      if (post.authorId === user?.uid) {
        await updateDoc(doc(db, 'users', post.authorId), {
          postsCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}`);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        targetType: 'post',
        targetId: post.id,
        targetOwnerId: post.authorId,
        reason: reportReason,
        details: post.content.slice(0, 200),
        status: 'pending',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setReportOpen(false);
        setReportSubmitted(false);
      }, 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  const handleVideoPlay = async () => {
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        viewsCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore view increment errors for unauthenticated viewers
    }
  };

  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = comments.reduce<Record<string, PostComment[]>>((acc, c) => {
    if (c.parentCommentId) {
      acc[c.parentCommentId] = acc[c.parentCommentId] || [];
      acc[c.parentCommentId].push(c);
    }
    return acc;
  }, {});

  const activeReactionMeta = REACTIONS.find((r) => r.type === myReaction);

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/profile/${post.authorUsername}`} className="shrink-0">
            <Avatar
              src={post.authorAvatar}
              name={post.authorName}
              verified={post.authorVerified}
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/profile/${post.authorUsername}`}
                className="font-semibold text-sm text-slate-900 dark:text-white hover:underline truncate"
              >
                {post.authorName}
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                @{post.authorUsername}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{post.visibility}</span>
              {post.isEdited && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Edited</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Post options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg py-1 z-20">
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleToggleSave();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {isSaved ? 'Remove bookmark' : 'Save post'}
                </button>
              )}
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit post
                </button>
              )}
              {(isAuthor || isStaffMod) && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleDeletePost();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete post
                </button>
              )}
              {user && !isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Report post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div className="mt-3 space-y-2.5">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100"
          />
          <div className="flex items-center justify-between gap-2">
            <select
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value as PostVisibility)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium"
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 cursor-pointer"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {post.content && (
            <p className="mt-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-blue-700 dark:text-blue-400">
              {post.hashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onHashtagClick?.(tag)}
                  className="hover:underline cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Multi-image Gallery */}
      {post.mediaType === 'image' && post.mediaUrls && post.mediaUrls.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {post.mediaUrls.map((url, idx) =>
            isSafeUrl(url) ? (
              <div
                key={idx}
                className="relative group overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
                onClick={() => setLightboxUrl(url)}
              >
                <img
                  src={url}
                  alt={`Post media ${idx + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={`w-full object-cover transition-transform duration-200 group-hover:scale-[1.01] ${
                    post.mediaUrls!.length === 1 ? 'max-h-[460px]' : 'h-56'
                  }`}
                />
                <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3.5 h-3.5" />
                </span>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Video Player */}
      {post.mediaType === 'video' && post.videoUrl && isSafeUrl(post.videoUrl) && (
        <div className="mt-3 rounded-xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
          {post.videoTitle && (
            <div className="px-3.5 py-2 bg-slate-950 text-white text-xs font-semibold flex items-center justify-between">
              <span className="truncate">{post.videoTitle}</span>
              <span className="inline-flex items-center gap-1 text-slate-400 tabular-nums shrink-0">
                <Eye className="w-3.5 h-3.5" />
                {post.viewsCount}
              </span>
            </div>
          )}
          <video
            src={post.videoUrl}
            poster={post.videoThumbnail && isSafeUrl(post.videoThumbnail) ? post.videoThumbnail : undefined}
            controls
            preload="metadata"
            onPlay={() => void handleVideoPlay()}
            className="w-full max-h-[460px]"
          />
        </div>
      )}

      {/* Engagement Summary */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        <div className="flex items-center gap-2">
          <span>{post.likesCount} reactions</span>
          {post.mediaType === 'video' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.viewsCount} views</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{post.commentsCount} comments</span>
          <span>{post.sharesCount} shares</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
        {settings.features.reactionsEnabled && (
          <div
            className="relative flex-1"
            onMouseEnter={() => setShowReactionTray(true)}
            onMouseLeave={() => setShowReactionTray(false)}
          >
            <button
              type="button"
              onClick={() => void handleReact(myReaction || 'like')}
              className={`w-full py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                myReaction
                  ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {activeReactionMeta ? (
                <span>{activeReactionMeta.emoji}</span>
              ) : (
                <ThumbsUp className="w-4 h-4" />
              )}
              <span>{activeReactionMeta ? activeReactionMeta.label : 'Like'}</span>
            </button>

            {showReactionTray && user && (
              <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg z-20">
                {REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => void handleReact(r.type)}
                    title={r.label}
                    className="w-8 h-8 rounded-full hover:scale-125 transition-transform flex items-center justify-center text-base cursor-pointer"
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {settings.features.commentsEnabled && (
          <button
            type="button"
            onClick={() => setShowComments((c) => !c)}
            className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Repeat2 className="w-4 h-4" />
          <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
        </button>

        {user && (
          <button
            type="button"
            onClick={() => void handleToggleSave()}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              isSaved
                ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Save post"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Comments & Nested Replies */}
      {showComments && settings.features.commentsEnabled && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {user && user.emailVerified ? (
            <form onSubmit={handleAddComment} className="space-y-1.5">
              {replyTo && (
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>Replying to @{replyTo.authorUsername}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={replyTo ? 'Write a reply...' : 'Write a comment...'}
                  maxLength={1000}
                  className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="p-2 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                  aria-label="Send comment"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in with a verified account to join the discussion.
            </p>
          )}

          <div className="space-y-2.5">
            {topLevelComments.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex gap-2.5">
                  <Avatar src={c.authorAvatar} name={c.authorName} size="xs" />
                  <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950/70 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/profile/${c.authorUsername}`}
                        className="text-xs font-semibold text-slate-900 dark:text-white hover:underline"
                      >
                        {c.authorName}
                      </Link>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-words">
                      {c.content}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      {user && (
                        <button
                          type="button"
                          onClick={() => setReplyTo(c)}
                          className="hover:text-blue-700 dark:hover:text-blue-400 font-medium cursor-pointer"
                        >
                          Reply
                        </button>
                      )}
                      {(user?.uid === c.authorId || isAuthor || isStaffMod) && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(c.id)}
                          className="hover:text-red-600 font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {(repliesByParent[c.id] || []).map((reply) => (
                  <div key={reply.id} className="flex gap-2.5 ml-8">
                    <Avatar src={reply.authorAvatar} name={reply.authorName} size="xs" />
                    <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950/70 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/profile/${reply.authorUsername}`}
                          className="text-xs font-semibold text-slate-900 dark:text-white hover:underline"
                        >
                          {reply.authorName}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-words">
                        {reply.content}
                      </p>
                      {(user?.uid === reply.authorId || isAuthor || isStaffMod) && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(reply.id)}
                          className="mt-1 text-[11px] text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            aria-label="Close image preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full preview"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
          />
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500 hidden" />
                Report Content
              </h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {reportSubmitted ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium py-4">
                Report submitted to FRIENDLY MEDIA moderation staff. Thank you.
              </p>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Select a reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="Spam or misleading">Spam or misleading</option>
                    <option value="Harassment or hate speech">Harassment or hate speech</option>
                    <option value="Violence or unsafe content">Violence or unsafe content</option>
                    <option value="Intellectual property violation">Intellectual property violation</option>
                    <option value="Impersonation">Impersonation</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
