'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'sortie-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
    const initial = stored || 'dark';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (next: 'dark' | 'light') => {
    const root = document.documentElement;
    if (next === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  };

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  // Avoid hydration mismatch: render placeholder until mounted
  if (theme === null) {
    return <div className="w-7 h-7" />;
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'switch to dark' : 'switch to light'}
      className="w-7 h-7 rounded border border-line text-dim hover:text-ink hover:border-line2 hover:bg-surface2 transition flex items-center justify-center font-mono"
    >
      {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
    </button>
  );
}

// Synchronous theme init script (runs in <head> before paint, prevents flash)
export const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t === 'light') {
      document.documentElement.classList.add('light');
    }
  } catch (e) {}
})();
`;
