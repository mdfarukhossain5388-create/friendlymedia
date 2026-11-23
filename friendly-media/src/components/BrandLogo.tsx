import { useSiteSettings } from '../contexts/SiteSettingsContext';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function BrandLogo({ size = 'md', showText = true }: BrandLogoProps) {
  const { settings } = useSiteSettings();
  const dim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';

  return (
    <span className="inline-flex items-center gap-2.5 shrink-0">
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={settings.siteName}
          referrerPolicy="no-referrer"
          className={`${dim} rounded-xl object-cover shadow-sm`}
        />
      ) : (
        <span
          className={`${dim} rounded-xl flex items-center justify-center shadow-sm shrink-0`}
          style={{
            background: `linear-gradient(135deg, ${settings.primaryColor || '#1d4ed8'}, ${settings.secondaryColor || '#0f766e'})`,
          }}
        >
          <svg viewBox="0 0 40 40" fill="none" className="w-6 h-6" aria-hidden="true">
            <circle cx="15.5" cy="20" r="7" stroke="#FFFFFF" strokeWidth="2.8" />
            <circle cx="24.5" cy="20" r="7" stroke="#FFFFFF" strokeWidth="2.8" strokeOpacity="0.9" />
            <circle cx="20" cy="20" r="2.2" fill="#FFFFFF" />
          </svg>
        </span>
      )}
      {showText && (
        <span className="font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap text-base sm:text-lg">
          {settings.siteName}
        </span>
      )}
    </span>
  );
}
