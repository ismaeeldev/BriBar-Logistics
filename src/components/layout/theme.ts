/**
 * The theme preference, shared by the head script and the toggle.
 *
 * Three states, not two. "System" is a real preference — a driver whose phone
 * flips to dark at sunset expects the app to follow — and collapsing it into
 * whichever value the OS happened to hold on first visit silently takes that
 * away.
 */
export const THEME_STORAGE_KEY = 'bribar-theme';

export const THEMES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEMES)[number];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * The script that runs before the first paint.
 *
 * It is a string because it has to be inlined into the document head and
 * executed synchronously: anything that waits for React has already let the
 * browser paint the default theme, and the flash is the whole problem.
 *
 * Written defensively — `localStorage` throws outright in a browser configured
 * to block site data, and a theme preference is never worth a blank page.
 */
export const THEME_SCRIPT = `
(function () {
  var root = document.documentElement;
  function resolve() {
    var stored = null;
    try { stored = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) {}
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply() { root.setAttribute('data-theme', resolve()); }
  apply();
  // Follow the OS while the preference is "system"; a stored choice wins.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
})();
`.trim();
