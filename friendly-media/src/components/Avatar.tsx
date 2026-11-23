import { BadgeCheck } from 'lucide-react';
import { isSafeUrl } from '../utils/validation';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  verified?: boolean;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export function Avatar({ src, name, size = 'md', isOnline, verified }: AvatarProps) {
  const safeSrc = src && isSafeUrl(src) ? src : '';
  const initials = (name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {safeSrc ? (
        <img
          src={safeSrc}
          alt={name}
          referrerPolicy="no-referrer"
          className={`${SIZE_MAP[size]} rounded-full object-cover bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80`}
        />
      ) : (
        <div
          className={`${SIZE_MAP[size]} rounded-full bg-gradient-to-br from-blue-600 to-teal-600 text-white font-bold flex items-center justify-center select-none`}
          aria-label={name}
        >
          {initials}
        </div>
      )}
      {isOnline && (
        <span
          title="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
      {verified && (
        <span
          title="Verified account"
          className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-slate-900 rounded-full p-0.5"
        >
          <BadgeCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        </span>
      )}
    </div>
  );
}
