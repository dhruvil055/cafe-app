import { createContext, useContext, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'infini_theme';
const THEME_ATTR = 'data-theme';

export function ThemeProvider({ children }) {
  // Force light theme permanently across the application
  const theme = 'light';
  const isDark = false;

  // Apply light theme to document element immediately
  const applyLightTheme = useCallback(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute(THEME_ATTR, 'light');
    root.style.colorScheme = 'light';
  }, []);

  // Apply on mount and prevent any dark mode from being applied
  useEffect(() => {
    applyLightTheme();

    // Clear any previously saved dark theme preference
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    // Ensure system dark mode preference does not switch to dark
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyLightTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyLightTheme]);

  // Provide a no-op toggle function for backwards compatibility
  const toggleTheme = useCallback(() => {
    console.debug('Dark mode is disabled');
  }, []);

  const value = {
    theme,
    setTheme: () => {},
    toggleTheme,
    isDark,
    mounted: true,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Backwards compatibility hook for Super Admin components
export function useSuperAdminTheme() {
  const { theme, toggleTheme, isDark } = useTheme();
  return { theme, setTheme: () => {}, toggleTheme, isDark };
}