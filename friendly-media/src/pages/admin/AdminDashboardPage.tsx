import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type {
  AdsterraPlacement,
  AuditLog,
  ContactMessage,
  ModerationReport,
  Post,
  UserProfile,
} from '../../types';
import { AdminLayout } from './AdminLayout';

export function AdminDashboardPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [ads, setAds] = useState<AdsterraPlacement[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [uSnap, pSnap, rSnap, aSnap, lSnap, cSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'posts')),
          getDocs(collection(db, 'reports')),
          getDocs(collection(db, 'adsterraPlacements')),
          getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(10))),
          getDocs(query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(8))),
        ]);

        setUsers(uSnap.docs.map((d) => d.data() as UserProfile));
        setPosts(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) })));
        setReports(
          rSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationReport, 'id'>) }))
        );
        setAds(
          aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdsterraPlacement, 'id'>) }))
        );
        setLogs(lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) })));
        setContacts(
          cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactMessage, 'id'>) }))
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const activeUsers = users.filter((u) => u.accountStatus === 'active').length;
  const totalVideos = posts.filter((p) => p.mediaType === 'video').length;
  const totalComments = posts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);
  const pendingReports = reports.filter((r) => r.status === 'pending').length;
  const enabledAds = ads.filter((a) => a.enabled).length;

  const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
  const newRegistrations = users.filter(
    (u) => u.createdAt?.toDate && u.createdAt.toDate().getTime() >= sevenDaysAgo
  ).length;

  const kpis = [
    { label: 'Total Users', value: users.length },
    { label: 'Active Users', value: activeUsers },
    { label: 'New Registrations (7d)', value: newRegistrations },
    { label: 'Total Posts', value: posts.length },
    { label: 'Total Videos', value: totalVideos },
    { label: 'Total Comments', value: totalComments },
    { label: 'Pending Reports', value: pendingReports },
    { label: 'Active Adsterra Slots', value: `${enabledAds} / ${ads.length}` },
  ];

  return (
    <AdminLayout title="Platform Overview">
      <div className="space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                  {k.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Audit Logs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Recent Security & Audit Logs
            </h2>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                Administrative actions will appear here as an immutable audit trail.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <div key={log.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.action}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      {log.actorEmail} ({log.actorRole}) · {log.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Messages */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Support & Contact Inquiries
              </h2>
              <Link to="/admin/adsterra" className="text-xs font-semibold text-blue-600 hover:underline">
                Adsterra Settings →
              </Link>
            </div>
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No contact inquiries received yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <div key={c.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{c.subject}</span>
                      <span className="text-slate-400">{c.status}</span>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      From {c.name} ({c.email}) — {c.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
