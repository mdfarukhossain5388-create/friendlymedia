import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  AdsterraDeviceTarget,
  AdsterraDisplayRule,
  AdsterraFormat,
  AdsterraPlacement,
  AdsterraPlacementSlot,
} from '../../types';
import { recordAdminAudit } from '../../utils/audit';
import { validateAdsterraInput } from '../../utils/validation';
import { AdminLayout } from './AdminLayout';

const EMPTY_FORM = {
  name: '',
  format: 'display_banner' as AdsterraFormat,
  placement: 'sidebar' as AdsterraPlacementSlot,
  deviceTarget: 'all' as AdsterraDeviceTarget,
  scriptCode: '',
  directLinkUrl: '',
  frequency: 4,
  enabled: true,
  displayRule: 'all_pages' as AdsterraDisplayRule,
};

export function AdminAdsterraPage({ view = 'settings' }: { view?: 'settings' | 'monetization' }) {
  const { user, adminRole } = useAuth();
  const [placements, setPlacements] = useState<AdsterraPlacement[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<AdsterraPlacementSlot | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPlacements = async () => {
    const snap = await getDocs(
      query(collection(db, 'adsterraPlacements'), orderBy('createdAt', 'desc'))
    );
    setPlacements(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdsterraPlacement, 'id'>),
      }))
    );
  };

  useEffect(() => {
    void loadPlacements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !adminRole) return;
    setError('');
    setNotice('');

    const validation = validateAdsterraInput(form.scriptCode, form.directLinkUrl);
    if (!validation.valid) {
      setError(validation.reason || 'Invalid Adsterra configuration.');
      return;
    }

    try {
      const payload = {
        name: form.name.trim().slice(0, 80),
        format: form.format,
        placement: form.placement,
        deviceTarget: form.deviceTarget,
        scriptCode: form.scriptCode.trim(),
        directLinkUrl: form.directLinkUrl.trim(),
        frequency: Math.min(25, Math.max(1, Number(form.frequency) || 4)),
        enabled: form.enabled,
        displayRule: form.displayRule,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'adsterraPlacements', editingId), payload);
        await recordAdminAudit({
          actorId: user.uid,
          actorEmail: user.email || '',
          actorRole: adminRole.role,
          action: 'adsterra.placement.update',
          targetType: 'adsterraPlacement',
          targetId: editingId,
          details: `Updated Adsterra placement "${payload.name}" (${payload.placement})`,
        });
        setNotice('Adsterra placement updated.');
      } else {
        const ref = await addDoc(collection(db, 'adsterraPlacements'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await recordAdminAudit({
          actorId: user.uid,
          actorEmail: user.email || '',
          actorRole: adminRole.role,
          action: 'adsterra.placement.create',
          targetType: 'adsterraPlacement',
          targetId: ref.id,
          details: `Created Adsterra placement "${payload.name}" (${payload.placement})`,
        });
        setNotice('Adsterra placement added.');
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadPlacements();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'adsterraPlacements');
    }
  };

  const handleToggle = async (item: AdsterraPlacement) => {
    if (!user || !adminRole) return;
    await updateDoc(doc(db, 'adsterraPlacements', item.id), {
      enabled: !item.enabled,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: item.enabled ? 'adsterra.disable' : 'adsterra.enable',
      targetType: 'adsterraPlacement',
      targetId: item.id,
      details: `${item.enabled ? 'Disabled' : 'Enabled'} Adsterra placement "${item.name}"`,
    });
    await loadPlacements();
  };

  const handleDelete = async (item: AdsterraPlacement) => {
    if (!user || !adminRole) return;
    await deleteDoc(doc(db, 'adsterraPlacements', item.id));
    await recordAdminAudit({
      actorId: user.uid,
      actorEmail: user.email || '',
      actorRole: adminRole.role,
      action: 'adsterra.delete',
      targetType: 'adsterraPlacement',
      targetId: item.id,
      details: `Deleted Adsterra placement "${item.name}"`,
    });
    await loadPlacements();
  };

  const enabledCount = placements.filter((p) => p.enabled).length;

  return (
    <AdminLayout
      title={view === 'monetization' ? 'Monetization Dashboard (Adsterra)' : 'Monetization → Adsterra Settings'}
    >
      <div className="space-y-6">
        {/* Status Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Adsterra Exclusive Advertising Network
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              FRIENDLY MEDIA uses Adsterra exclusively (Social Bar, Native Banner, Display Banner, Direct Link / Smartlink). Revenue metrics appear only when connected to verified Adsterra Publisher API reporting.
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className="text-xs text-slate-500">Active Placements</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {enabledCount} / {placements.length}
            </p>
          </div>
        </div>

        {view === 'monetization' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Configured Formats</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {new Set(placements.map((p) => p.format)).size}
              </p>
              <p className="text-xs text-slate-500 mt-1">Social Bar, Native, Display, Direct Link</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Desktop / Mobile Coverage</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {placements.filter((p) => p.enabled && p.deviceTarget !== 'mobile').length} D ·{' '}
                {placements.filter((p) => p.enabled && p.deviceTarget !== 'desktop').length} M
              </p>
              <p className="text-xs text-slate-500 mt-1">Independent device rules</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Verified Reporting Feed</p>
              <p className="text-sm font-semibold mt-2 text-slate-700 dark:text-slate-300">
                Awaiting Adsterra Publisher API Key
              </p>
              <p className="text-xs text-slate-500 mt-1">
                No estimated or simulated earnings are displayed.
              </p>
            </div>
          </div>
        )}

        {/* Create / Edit Adsterra Placement Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Adsterra Placement' : 'Add New Adsterra Placement'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Placement Label
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main Sidebar Native"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Adsterra Format
              </label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as AdsterraFormat })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              >
                <option value="social_bar">Adsterra Social Bar</option>
                <option value="native_banner">Native Banner</option>
                <option value="display_banner">Display Banner</option>
                <option value="direct_link">Direct Link / Smartlink</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Placement Location
              </label>
              <select
                value={form.placement}
                onChange={(e) =>
                  setForm({ ...form, placement: e.target.value as AdsterraPlacementSlot })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              >
                <option value="header">Header</option>
                <option value="sidebar">Sidebar</option>
                <option value="news_feed">News Feed Top</option>
                <option value="between_posts">Between Posts</option>
                <option value="video_page">Video Page</option>
                <option value="footer">Footer</option>
                <option value="mobile">Mobile Banner</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Device Target
              </label>
              <select
                value={form.deviceTarget}
                onChange={(e) =>
                  setForm({ ...form, deviceTarget: e.target.value as AdsterraDeviceTarget })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              >
                <option value="all">All Devices</option>
                <option value="desktop">Desktop Only</option>
                <option value="mobile">Mobile Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Display Rule
              </label>
              <select
                value={form.displayRule}
                onChange={(e) =>
                  setForm({ ...form, displayRule: e.target.value as AdsterraDisplayRule })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              >
                <option value="all_pages">All Visitors</option>
                <option value="guests_only">Guests Only</option>
                <option value="logged_in_only">Logged-in Members Only</option>
                <option value="feed_and_videos">Feed & Videos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                In-Feed Frequency (Every N Posts)
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Direct Link / Smartlink URL (Optional)
              </label>
              <input
                type="url"
                value={form.directLinkUrl}
                onChange={(e) => setForm({ ...form, directLinkUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Adsterra Script Code / Invoke URL
            </label>
            <textarea
              rows={3}
              value={form.scriptCode}
              onChange={(e) => setForm({ ...form, scriptCode: e.target.value })}
              placeholder='<script type="text/javascript" src="https://..."></script>'
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enable this Adsterra placement immediately
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-xs sm:text-sm font-semibold hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {editingId ? 'Update Placement' : 'Save Adsterra Placement'}
            </button>
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          {notice && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> {notice}
            </p>
          )}
        </form>

        {/* Placement List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold">Configured Adsterra Placements</h3>
            <span className="text-xs text-slate-500">Click Preview to inspect slot layout</span>
          </div>

          {placements.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No Adsterra placements configured yet. Add your first placement above.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {placements.map((item) => (
                <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.format.replace('_', ' ')} · {item.placement.replace('_', ' ')} ·{' '}
                      {item.deviceTarget} · {item.displayRule.replace('_', ' ')} · Every{' '}
                      {item.frequency} posts
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPlacement(
                          previewPlacement === item.placement ? null : item.placement
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggle(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        item.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          format: item.format,
                          placement: item.placement,
                          deviceTarget: item.deviceTarget,
                          scriptCode: item.scriptCode,
                          directLinkUrl: item.directLinkUrl || '',
                          frequency: item.frequency,
                          enabled: item.enabled,
                          displayRule: item.displayRule,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Wireframe Preview */}
        {previewPlacement && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Layout Preview: {previewPlacement.replace('_', ' ')} slot
            </p>
            <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold text-center">
              <div
                className={`col-span-12 p-3 rounded-xl border ${
                  previewPlacement === 'header' || previewPlacement === 'mobile'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                Header / Mobile Banner Slot
              </div>
              <div className="col-span-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400">
                Left Nav
              </div>
              <div className="col-span-6 space-y-2">
                <div
                  className={`p-3 rounded-xl border ${
                    previewPlacement === 'news_feed' || previewPlacement === 'video_page'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  Feed / Video Top Slot
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400">
                  Post Stream
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    previewPlacement === 'between_posts'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  Between-Posts Native Slot
                </div>
              </div>
              <div
                className={`col-span-3 p-6 rounded-xl border ${
                  previewPlacement === 'sidebar'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                Sidebar Slot
              </div>
              <div
                className={`col-span-12 p-3 rounded-xl border ${
                  previewPlacement === 'footer'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                Footer Slot
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
