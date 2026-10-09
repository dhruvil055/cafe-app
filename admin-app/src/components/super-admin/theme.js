import { useState, useEffect } from 'react';

const STORAGE_KEY = 'brewhaus_superadmin_theme';

export function applyThemeToDocument(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light', 'sa-light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light', 'sa-light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }
}

export function useSuperAdminTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
    applyThemeToDocument(saved);
    return saved;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyThemeToDocument(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
