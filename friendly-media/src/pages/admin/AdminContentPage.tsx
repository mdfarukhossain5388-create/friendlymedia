import { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Trash2, XCircle } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { ModerationReport, Post } from '../../types';
import { recordAdminAudit } from '../../utils/audit';
import { AdminLayout } from './AdminLayout';

export function AdminContentPage() {
  const { user, adminRole } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [tab, setTab] = useState<'posts' | 'videos' | 'reports'>('posts');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadContent = async () => {
    const [pSnap, rSnap] = await Promise.all([
      getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'))),
    ]);
    setPosts(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) })));
    setReports(
      rSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationReport, 'id'>) }))
    );
  };

  useEffect(() => {
    void loadContent();
  }, []);

  const handleDeletePost = async (post: Post) => {
    if (!user || !adminRole) return;
    await deleteDoc(doc(db, 'posts', post.id));
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'post.delete',
      targetType: 'post',
      targetId: post.id,
      details: `Removed post by @${post.authorUsername}`,
    });
    await loadContent();
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !user || !adminRole) return;
    await updateDoc(doc(db, 'posts', editingPost.id), {
      content: editContent.trim().slice(0, 5000),
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'post.edit',
      targetType: 'post',
      targetId: editingPost.id,
      details: `Moderated post text by @${editingPost.authorUsername}`,
    });
    setEditingPost(null);
    await loadContent();
  };

  const handleReportStatus = async (report: ModerationReport, status: 'resolved' | 'dismissed') => {
    if (!user || !adminRole) return;
    await updateDoc(doc(db, 'reports', report.id), {
      status,
      reviewedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: `report.${status}`,
      targetType: 'report',
      targetId: report.id,
      details: `Marked report ${status} (${report.targetType}:${report.targetId})`,
    });
    await loadContent();
  };

  const visiblePosts = tab === 'videos' ? posts.filter((p) => p.mediaType === 'video') : posts;

  return (
    <AdminLayout title="Content & Moderation">
      <div className="space-y-5">
        <div className="flex gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
          {(['posts', 'videos', 'reports'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                tab === t
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t} ({t === 'reports' ? reports.length : t === 'videos' ? posts.filter((p) => p.mediaType === 'video').length : posts.length})
            </button>
          ))}
        </div>

        {tab === 'reports' ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            {reports.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No reports in the moderation queue.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {r.reason} · <span className="capitalize">{r.targetType}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xl">
                      Target: {r.targetId} · Status: <strong>{r.status}</strong> · {r.details}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReportStatus(r, 'resolved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReportStatus(r, 'dismissed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            {visiblePosts.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No {tab} published yet.</p>
            ) : (
              visiblePosts.map((p) => (
                <div key={p.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <strong className="text-slate-900 dark:text-white">{p.authorName}</strong>
                      <span>@{p.authorUsername}</span>
                      <span>·</span>
                      <span className="capitalize">{p.mediaType}</span>
                      <span>·</span>
                      <span className="capitalize">{p.visibility}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 break-words">
                      {p.videoTitle ? `[Video: ${p.videoTitle}] ` : ''}
                      {p.content || '(Media post)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPost(p);
                        setEditContent(p.content);
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Edit post"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePost(p)}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {editingPost && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
              <h2 className="text-base font-bold">Moderate Post Content</h2>
              <textarea
                rows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
