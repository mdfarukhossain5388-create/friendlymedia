import React, { useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { MainLayout } from '../components/MainLayout';

export function AboutPage() {
  const { settings } = useSiteSettings();
  return (
    <MainLayout hideRightSidebar>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          About {settings.siteName}
        </h1>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{settings.tagline}</p>
        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {settings.aboutContent}
        </p>
      </div>
    </MainLayout>
  );
}

export function PrivacyPage() {
  const { settings } = useSiteSettings();
  return (
    <MainLayout hideRightSidebar>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="text-xs text-slate-500">Effective across {settings.siteName}</p>
        <div className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {settings.privacyContent}
        </div>
      </div>
    </MainLayout>
  );
}

export function TermsPage() {
  const { settings } = useSiteSettings();
  return (
    <MainLayout hideRightSidebar>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Terms and Conditions</h1>
        <p className="text-xs text-slate-500">Community agreement for {settings.siteName}</p>
        <div className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {settings.termsContent}
        </div>
      </div>
    </MainLayout>
  );
}

export function ContactPage() {
  const { settings } = useSiteSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'contactMessages'), {
        name: name.trim().slice(0, 80),
        email: email.trim().slice(0, 254),
        subject: subject.trim().slice(0, 120),
        message: message.trim().slice(0, 2000),
        status: 'new',
        createdAt: serverTimestamp(),
      });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout hideRightSidebar>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contact Us</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Direct support email: {settings.contactEmail}
          </p>
        </div>

        {sent ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Your message has been delivered to {settings.siteName} support staff.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Message
              </label>
              <textarea
                rows={4}
                required
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
