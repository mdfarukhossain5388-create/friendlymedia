import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { AppNotification } from '../types';
import { Avatar } from '../components/Avatar';
import { MainLayout } from '../components/MainLayout';
import { formatRelativeTime } from '../components/PostCard';

export function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AppNotification, 'id'>),
          }))
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );
    return () => unsub();
  }, [user]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    items.filter((i) => !i.isRead).forEach((i) => {
      batch.update(doc(db, 'notifications', i.id), { isRead: true });
    });
    await batch.commit();
  };

  return (
    <MainLayout>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            Notifications
          </h1>
          {items.some((i) => !i.isRead) && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            You are all caught up. New likes, comments, followers, and announcements will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && void markRead(n.id)}
                className={`p-4 flex items-start justify-between gap-3 cursor-pointer ${
                  !n.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar src={n.actorAvatar} name={n.actorName} size="sm" />
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">{n.message}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatRelativeTime(n.createdAt)}</span>
                      {n.actorUsername && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Link
                            to={`/profile/${n.actorUsername}`}
                            className="text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            View profile
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
