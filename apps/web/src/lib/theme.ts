export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'nh-theme';
const MOTION_KEY = 'nh-reduce-motion';

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? systemTheme() : preference;
}

export function applyTheme(preference: ThemePreference, reduceMotion?: boolean): void {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b0e19' : '#f8f6f1');
  if (reduceMotion !== undefined) {
    document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
    localStorage.setItem(MOTION_KEY, reduceMotion ? 'true' : 'false');
  }
}

export function initializeTheme(): void {
  const saved = (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? 'system';
  applyTheme(saved, localStorage.getItem(MOTION_KEY) === 'true');
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if ((localStorage.getItem(THEME_KEY) as ThemePreference | null) === 'system') applyTheme('system');
  });
}

export function storeTheme(preference: ThemePreference, reduceMotion?: boolean): void {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference, reduceMotion);
}

export function getStoredTheme(): ThemePreference {
  return (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? 'system';
}
