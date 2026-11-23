import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Search, Shield, Trash2 } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { AccountStatus, AdminRole, StaffRole, UserProfile } from '../../types';
import { recordAdminAudit } from '../../utils/audit';
import { Avatar } from '../../components/Avatar';
import { AdminLayout } from './AdminLayout';

export function AdminUsersPage() {
  const { user, adminRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, AdminRole>>({});
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [uSnap, aSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);
      setUsers(uSnap.docs.map((d) => d.data() as UserProfile));
      const map: Record<string, AdminRole> = {};
      aSnap.docs.forEach((d) => {
        map[d.id] = d.data() as AdminRole;
      });
      setStaffMap(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [search, users]);

  const isSuperAdmin = adminRole?.role === 'super_admin';

  const handleStatusChange = async (target: UserProfile, status: AccountStatus) => {
    if (!user || !adminRole) return;
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        accountStatus: status,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        actorId: user.uid,
        actorEmail: user.email || '',
        actorRole: adminRole.role,
        action: `user.status.${status}`,
        targetType: 'user',
        targetId: target.uid,
        details: `Set @${target.username} status to ${status}`,
      });
      await loadAll();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleToggleVerify = async (target: UserProfile) => {
    if (!user || !adminRole) return;
    const next = !target.verified;
    await updateDoc(doc(db, 'users', target.uid), {
      verified: next,
      updatedAt: serverTimestamp(),
    });
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: next ? 'user.verify' : 'user.unverify',
      targetType: 'user',
      targetId: target.uid,
      details: `${next ? 'Verified' : 'Unverified'} @${target.username}`,
    });
    await loadAll();
  };

  const handleRoleAssign = async (target: UserProfile, role: StaffRole | 'member') => {
    if (!user || !adminRole || !isSuperAdmin) return;
    if (target.uid === user.uid) return;
    if (role === 'member') {
      await deleteDoc(doc(db, 'admins', target.uid));
    } else {
      await setDoc(doc(db, 'admins', target.uid), {
        uid: target.uid,
        email: `${target.username}@friendlymedia.user`,
        role,
        grantedBy: user.uid,
        createdAt: staffMap[target.uid]?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'admin.role.change',
      targetType: 'user',
      targetId: target.uid,
      details: `Assigned role ${role} to @${target.username}`,
    });
    await loadAll();
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !user || !adminRole) return;
    await updateDoc(doc(db, 'users', editingUser.uid), {
      displayName: editName.trim().slice(0, 60),
      bio: editBio.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'user.edit',
      targetType: 'user',
      targetId: editingUser.uid,
      details: `Edited profile info for @${editingUser.username}`,
    });
    setEditingUser(null);
    await loadAll();
  };

  const handleDeleteUser = async (target: UserProfile) => {
    if (!user || !adminRole || !isSuperAdmin || target.uid === user.uid) return;
    await deleteDoc(doc(db, 'users', target.uid));
    await deleteDoc(doc(db, 'usernames', target.username));
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'user.delete',
      targetType: 'user',
      targetId: target.uid,
      details: `Deleted account @${target.username}`,
    });
    await loadAll();
  };

  return (
    <AdminLayout title="User Management">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, @username, or UID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {filtered.length} accounts
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Verified</th>
                <th className="py-3 px-4 font-semibold">Staff Role</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading user directory...
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const staff = staffMap[u.uid];
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={u.avatarUrl} name={u.displayName} size="xs" verified={u.verified} />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{u.displayName}</p>
                            <p className="text-slate-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span
                          className={
                            u.accountStatus === 'active'
                              ? 'text-emerald-600 font-semibold'
                              : u.accountStatus === 'suspended'
                              ? 'text-amber-600 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => void handleToggleVerify(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                            u.verified
                              ? 'border-blue-300 text-blue-700 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                          {u.verified ? 'Verified' : 'Verify'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {isSuperAdmin && u.uid !== user?.uid ? (
                          <select
                            value={staff?.role || 'member'}
                            onChange={(e) =>
                              void handleRoleAssign(u, e.target.value as StaffRole | 'member')
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                          >
                            <option value="member">Member</option>
                            <option value="support">Support Staff</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 capitalize">
                            {staff ? (
                              <>
                                <Shield className="w-3.5 h-3.5 text-blue-600" />
                                {staff.role.replace('_', ' ')}
                              </>
                            ) : (
                              'Member'
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setEditName(u.displayName);
                              setEditBio(u.bio || '');
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Edit
                          </button>
                          {u.accountStatus === 'active' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(u, 'suspended')}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold cursor-pointer"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(u, 'banned')}
                                className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-semibold cursor-pointer"
                              >
                                Ban
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleStatusChange(u, 'active')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold cursor-pointer"
                            >
                              Restore
                            </button>
                          )}
                          {isSuperAdmin && u.uid !== user?.uid && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(u)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              title="Delete account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
              <h2 className="text-base font-bold">Edit @{editingUser.username}</h2>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                placeholder="Display Name"
              />
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                placeholder="Bio"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
