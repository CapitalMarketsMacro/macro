/**
 * Read the initial dark-mode state from localStorage or system preference.
 * Safe for SSR — returns `false` when `window` is unavailable.
 */
export function getInitialIsDark(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = localStorage.getItem('theme');
  if (stored) return stored === 'dark';

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply dark/light mode to the document root:
 *  - toggles the `dark` CSS class on `<html>`
 *  - persists the choice to localStorage
 */
export function applyDarkMode(isDark: boolean): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * Listen for OS-level color-scheme changes.
 * The callback fires only when the user has NOT explicitly chosen a theme
 * (i.e. localStorage `theme` key is absent).
 *
 * @returns A cleanup function that removes the listener.
 */
export function onSystemThemeChange(cb: (isDark: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    if (!localStorage.getItem('theme')) {
      cb(e.matches);
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
