import { createContext, useContext, useEffect, useCallback } from 'react';

const LightModeContext = createContext(null);

export function LightModeProvider({ children }) {
  // Force light theme - no state, no toggle
  const theme = 'light';
  const isDark = false;

  // Apply light theme to document element immediately
  const applyLightTheme = useCallback(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }, []);

  // Apply on mount and prevent any dark mode from being applied
  useEffect(() => {
    applyLightTheme();
    
    // Remove any saved dark mode preference for this app
    localStorage.removeItem('infini_theme');
    
    // Prevent system dark mode from affecting this app
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Always re-apply light theme if system tries to switch
      applyLightTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyLightTheme]);

  // Provide a no-op toggle function for backwards compatibility
  const toggleTheme = useCallback(() => {
    // No-op - dark mode is disabled
    console.debug('Dark mode is disabled in Café Admin panel');
  }, []);

  const value = {
    theme,
    setTheme: () => {},
    toggleTheme,
    isDark,
    mounted: true,
  };

  return (
    <LightModeContext.Provider value={value}>
      {children}
    </LightModeContext.Provider>
  );
}

export function useLightMode() {
  const context = useContext(LightModeContext);
  if (!context) {
    throw new Error('useLightMode must be used within a LightModeProvider');
  }
  return context;
}