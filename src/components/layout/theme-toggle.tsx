'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/components/layout/theme';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

const OPTIONS = [
  { value: 'light', icon: Sun, label: () => UI.common.themeLight },
  { value: 'dark', icon: Moon, label: () => UI.common.themeDark },
  { value: 'system', icon: Monitor, label: () => UI.common.themeSystem },
] as const satisfies readonly {
  value: ThemePreference;
  icon: typeof Sun;
  label: () => string;
}[];

/**
 * `localStorage` is an external store, so it is read as one.
 *
 * `useSyncExternalStore` is the sanctioned way to render a value React does
 * not own: it uses the server snapshot for SSR *and* for hydration, then
 * switches to the live one — which is exactly the sequence needed here, since
 * the server cannot know what is in this browser. Reading it in an effect and
 * calling `setState` would do the same thing by hand, one cascading render
 * later, and React's lint rule rightly objects.
 *
 * The listener set also means a second toggle on the page (or another tab,
 * through the `storage` event) stays in step.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // A browser configured to block site data throws on read. "System" is the
    // honest answer: nothing is remembered, so the OS decides.
    return 'system';
  }
}

/** No preference is knowable on the server, so nothing is claimed there. */
function getServerSnapshot(): ThemePreference | null {
  return null;
}

/**
 * Light / dark / system, as three radio buttons rather than one cycling icon.
 *
 * A single toggle can only ever show two of the three states, and the one it
 * hides is "system" — the state most people actually want. Three visible
 * options also say what will happen before the user commits, which a button
 * whose meaning changes on each press cannot.
 *
 * Until the store resolves, no option is highlighted. The head script has
 * already applied the right *colours* by then; only this highlight waits.
 */
export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = (next: ThemePreference) => {
    const root = document.documentElement;

    // Suppress every colour transition for one frame, so the swap lands as a
    // single repaint instead of a few hundred staggered crossfades.
    root.setAttribute('data-theme-switching', '');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.removeAttribute('data-theme-switching'));
    });

    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies to this page view; it just is not remembered.
    }

    const resolved =
      next === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : next;
    root.setAttribute('data-theme', resolved);

    emit();
  };

  return (
    <div
      role="radiogroup"
      aria-label={UI.common.theme}
      className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label()}
            title={label()}
            onClick={() => choose(value)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon aria-hidden className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
