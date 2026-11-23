import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Megaphone, Save } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SITE_SETTINGS, useSiteSettings } from '../../contexts/SiteSettingsContext';
import type { SiteSettings } from '../../types';
import { recordAdminAudit } from '../../utils/audit';
import { AdminLayout } from './AdminLayout';

export function AdminCustomizationPage({ mode = 'design' }: { mode?: 'design' | 'general' }) {
  const { user, adminRole } = useAuth();
  const { settings } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !adminRole) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'siteSettings', 'global'), {
        ...form,
        siteName: form.siteName.trim().slice(0, 60) || DEFAULT_SITE_SETTINGS.siteName,
        tagline: form.tagline.trim().slice(0, 120),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        actorId: user.uid,
        actorEmail: user.email || '',
        actorRole: adminRole.role,
        action: `siteSettings.${mode}.update`,
        targetType: 'siteSettings',
        targetId: 'global',
        details: `Updated website ${mode} settings (${form.siteName})`,
      });
      setSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'siteSettings/global');
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcastNotification = async () => {
    if (!user || !adminRole || !announcementMsg.trim()) return;
    setBroadcasting(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      await Promise.all(
        usersSnap.docs.map((u) =>
          addDoc(collection(db, 'notifications'), {
            recipientId: u.id,
            actorId: user.uid,
            actorName: form.siteName,
            actorUsername: 'admin',
            actorAvatar: form.logoUrl || '',
            type: 'announcement',
            targetId: 'global',
            message: announcementMsg.trim().slice(0, 300),
            isRead: false,
            createdAt: serverTimestamp(),
          })
        )
      );
      await recordAdminAudit({
        actorId: user.uid,
        actorEmail: user.email || '',
        actorRole: adminRole.role,
        action: 'announcement.broadcast',
        targetType: 'notifications',
        targetId: 'all',
        details: `Broadcast announcement to ${usersSnap.size} users`,
      });
      setAnnouncementMsg('');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <AdminLayout
      title={mode === 'design' ? 'Website Customization & Branding' : 'General Settings & Feature Controls'}
    >
      <form onSubmit={handleSave} className="space-y-6">
        {mode === 'design' ? (
          <>
            {/* Branding */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold">Brand Identity</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Website Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.siteName}
                    onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Custom Logo URL (Leave empty for built-in SVG emblem)
                  </label>
                  <input
                    type="url"
                    value={form.logoUrl || ''}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Favicon URL
                  </label>
                  <input
                    type="text"
                    value={form.faviconUrl || ''}
                    onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Design Tokens */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold">Design, Colors & Layout</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="w-11 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      className="w-11 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Typography Font
                  </label>
                  <select
                    value={form.fontFamily}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fontFamily: e.target.value as SiteSettings['fontFamily'],
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Manrope">Manrope</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Outfit">Outfit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Default Theme
                  </label>
                  <select
                    value={form.defaultTheme}
                    onChange={(e) =>
                      setForm({ ...form, defaultTheme: e.target.value as 'light' | 'dark' })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Header Appearance
                  </label>
                  <select
                    value={form.headerStyle}
                    onChange={(e) =>
                      setForm({ ...form, headerStyle: e.target.value as 'glass' | 'solid' })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="glass">Glassmorphism</option>
                    <option value="solid">Solid Surface</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Card Appearance
                  </label>
                  <select
                    value={form.cardStyle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cardStyle: e.target.value as 'elevated' | 'bordered' | 'glass',
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="bordered">Clean Bordered</option>
                    <option value="elevated">Soft Elevated</option>
                    <option value="glass">Translucent Glass</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Website Content */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold">Homepage & Announcement Content</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Homepage Hero Headline
                  </label>
                  <input
                    type="text"
                    value={form.heroHeadline}
                    onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Homepage Hero Subheadline
                  </label>
                  <textarea
                    rows={2}
                    value={form.heroSubheadline}
                    onChange={(e) => setForm({ ...form, heroSubheadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={form.footerText}
                    onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.announcementEnabled}
                      onChange={(e) =>
                        setForm({ ...form, announcementEnabled: e.target.checked })
                      }
                    />
                    Show global announcement banner across top of site
                  </label>
                  <input
                    type="text"
                    value={form.announcementBanner || ''}
                    onChange={(e) => setForm({ ...form, announcementBanner: e.target.value })}
                    placeholder="Announcement banner text..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Feature Controls */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold">Platform Feature Switches</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(
                  [
                    ['registrationEnabled', 'Allow New User Registrations'],
                    ['messagingEnabled', 'Enable Real-Time Private Messaging'],
                    ['videoUploadsEnabled', 'Enable Video Uploads & Sharing'],
                    ['commentsEnabled', 'Enable Post Comments & Replies'],
                    ['reactionsEnabled', 'Enable Post Reactions (Like, Love, etc.)'],
                    ['maintenanceMode', 'Enable Maintenance Mode (Admins retain access)'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="py-3 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <input
                      type="checkbox"
                      checked={form.features[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          features: { ...form.features, [key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* Legal & Pages Content */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold">Legal & Information Pages</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Contact Support Email
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  About Us Page Copy
                </label>
                <textarea
                  rows={3}
                  value={form.aboutContent}
                  onChange={(e) => setForm({ ...form, aboutContent: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Privacy Policy Content
                </label>
                <textarea
                  rows={4}
                  value={form.privacyContent}
                  onChange={(e) => setForm({ ...form, privacyContent: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Terms & Conditions Content
                </label>
                <textarea
                  rows={4}
                  value={form.termsContent}
                  onChange={(e) => setForm({ ...form, termsContent: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
            </section>

            {/* Broadcast Notification */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-600" />
                Broadcast Platform Notification
              </h2>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  placeholder="Send an official announcement notification to all members..."
                  className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
                <button
                  type="button"
                  disabled={broadcasting || !announcementMsg.trim()}
                  onClick={() => void handleBroadcastNotification()}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {broadcasting ? 'Sending...' : 'Send to All Users'}
                </button>
              </div>
            </section>
          </>
        )}

        <div className="flex items-center justify-between">
          {saved ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Changes applied live across {form.siteName}
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish Changes
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
