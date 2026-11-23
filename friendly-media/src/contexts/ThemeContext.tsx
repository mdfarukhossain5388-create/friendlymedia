import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSiteSettings } from './SiteSettingsContext';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSiteSettings();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem('fm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage error
    }
    return settings.defaultTheme || 'light';
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('fm_theme');
      if (!saved && (settings.defaultTheme === 'dark' || settings.defaultTheme === 'light')) {
        setThemeState(settings.defaultTheme);
      }
    } catch {
      // Ignore
    }
  }, [settings.defaultTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem('fm_theme', mode);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
