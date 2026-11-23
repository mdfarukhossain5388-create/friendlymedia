import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import type { AdsterraPlacementSlot } from '../types';
import { sanitizeExternalUrl } from '../utils/validation';

// Global deduplication guard so the same Adsterra script never loads twice
const injectedScriptUrls = new Set<string>();

interface AdsterraSlotProps {
  placement: AdsterraPlacementSlot;
  className?: string;
}

function extractScriptSrcs(html: string): string[] {
  const srcs: string[] = [];
  const regex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const url = sanitizeExternalUrl(match[1]);
    if (url) srcs.push(url);
  }
  return srcs;
}

export function AdsterraSlot({ placement, className = '' }: AdsterraSlotProps) {
  const { adPlacements } = useSiteSettings();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  const matchingPlacements = adPlacements.filter((ad) => {
    if (!ad.enabled) return false;
    if (ad.placement !== placement) return false;
    if (ad.deviceTarget === 'desktop' && isMobileViewport) return false;
    if (ad.deviceTarget === 'mobile' && !isMobileViewport) return false;
    if (ad.displayRule === 'guests_only' && user) return false;
    if (ad.displayRule === 'logged_in_only' && !user) return false;
    return true;
  });

  const activeAd = matchingPlacements[0];

  useEffect(() => {
    if (!activeAd || activeAd.format === 'direct_link') return;
    const raw = activeAd.scriptCode.trim();
    if (!raw) return;

    // Never allow Google AdSense scripts at runtime either
    const lower = raw.toLowerCase();
    if (lower.includes('googlesyndication') || lower.includes('adsbygoogle')) return;

    const srcs = extractScriptSrcs(raw);
    if (srcs.length > 0) {
      srcs.forEach((src) => {
        if (injectedScriptUrls.has(src)) return;
        injectedScriptUrls.add(src);
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.setAttribute('data-adsterra-id', activeAd.id);
        if (activeAd.format === 'social_bar') {
          document.body.appendChild(script);
        } else if (containerRef.current) {
          containerRef.current.appendChild(script);
        }
      });
    } else if (raw.startsWith('https://')) {
      if (!injectedScriptUrls.has(raw)) {
        injectedScriptUrls.add(raw);
        const script = document.createElement('script');
        script.src = raw;
        script.async = true;
        script.setAttribute('data-adsterra-id', activeAd.id);
        if (activeAd.format === 'social_bar') {
          document.body.appendChild(script);
        } else if (containerRef.current) {
          containerRef.current.appendChild(script);
        }
      }
    }
  }, [activeAd]);

  if (!activeAd) return null;

  if (activeAd.format === 'direct_link' && activeAd.directLinkUrl) {
    const safeLink = sanitizeExternalUrl(activeAd.directLinkUrl);
    if (!safeLink) return null;
    return (
      <div
        className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sponsored Partner · Adsterra
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
              {activeAd.name}
            </p>
          </div>
          <a
            href={safeLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity shrink-0 whitespace-nowrap"
          >
            Explore
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (activeAd.format === 'social_bar') {
    return null; // Social bar script runs globally once injected
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mb-2">
        <span>Sponsored · Adsterra</span>
        <span>{activeAd.format.replace('_', ' ')}</span>
      </div>
      <div
        ref={containerRef}
        className="min-h-[60px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400"
      />
    </div>
  );
}
