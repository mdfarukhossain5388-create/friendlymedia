import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AdsterraPlacement, SiteSettings } from '../types';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'FRIENDLY MEDIA',
  tagline: 'Connect. Share. Discover.',
  logoUrl: '',
  faviconUrl: '/favicon.svg',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f766e',
  fontFamily: 'Plus Jakarta Sans',
  defaultTheme: 'light',
  cardStyle: 'bordered',
  headerStyle: 'glass',
  sidebarStyle: 'expanded',
  announcementBanner: '',
  announcementEnabled: false,
  heroHeadline: 'Where global creators, communities, and real conversations come together.',
  heroSubheadline:
    'Share multi-photo stories, stream creator videos, follow inspiring voices worldwide, and chat in real time with complete privacy controls.',
  footerText: 'FRIENDLY MEDIA International. Built for authentic human connection worldwide.',
  aboutContent:
    'FRIENDLY MEDIA is an international social networking platform built around meaningful connections, creative storytelling, and transparent community standards. Founded to unite people across borders without algorithmic clutter, we give creators and everyday members full ownership over how they connect, share, and discover.',
  contactEmail: 'support@friendlymedia.international',
  privacyContent:
    'At FRIENDLY MEDIA, your privacy is foundational. Personal contact details such as your email address and blocked accounts are stored in isolated private records accessible strictly to you and authorized platform administrators when required for safety compliance. You control post visibility (public, followers, or private), messaging permissions, and full account deletion at any time in Settings.',
  termsContent:
    'By joining FRIENDLY MEDIA, you agree to treat fellow members with respect, publish only content you have rights to share, and refrain from spam, harassment, or automated scraping. Administrators reserve the right to suspend or remove accounts and content that violate community safety standards.',
  features: {
    registrationEnabled: true,
    messagingEnabled: true,
    videoUploadsEnabled: true,
    commentsEnabled: true,
    reactionsEnabled: true,
    maintenanceMode: false,
  },
  updatedBy: 'system',
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  adPlacements: AdsterraPlacement[];
  loading: boolean;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  adPlacements: [],
  loading: true,
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [adPlacements, setAdPlacements] = useState<AdsterraPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'siteSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteSettings>;
          setSettings({
            ...DEFAULT_SITE_SETTINGS,
            ...data,
            features: {
              ...DEFAULT_SITE_SETTINGS.features,
              ...(data.features || {}),
            },
          });
        } else {
          setSettings(DEFAULT_SITE_SETTINGS);
        }
        setLoading(false);
      },
      () => {
        // Fallback to defaults if rules reject or offline
        setLoading(false);
      }
    );

    const adsQuery = query(
      collection(db, 'adsterraPlacements'),
      where('enabled', '==', true)
    );
    const unsubAds = onSnapshot(
      adsQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdsterraPlacement, 'id'>),
        }));
        setAdPlacements(items);
      },
      () => {
        setAdPlacements([]);
      }
    );

    return () => {
      unsubSettings();
      unsubAds();
    };
  }, []);

  // Dynamically apply branding, colors, typography, and SEO tags whenever SiteSettings updates
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.primaryColor || '#1d4ed8');
    root.style.setProperty('--brand-secondary', settings.secondaryColor || '#0f766e');
    root.style.setProperty(
      '--app-font-sans',
      `'${settings.fontFamily || 'Plus Jakarta Sans'}', system-ui, -apple-system, sans-serif`
    );

    document.title = `${settings.siteName} — ${settings.tagline}`;

    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconLink && settings.faviconUrl) {
      faviconLink.href = settings.faviconUrl;
    }
  }, [settings]);

  return (
    <SiteSettingsContext.Provider value={{ settings, adPlacements, loading }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
