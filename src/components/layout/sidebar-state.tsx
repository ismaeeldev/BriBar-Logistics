'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Desktop sidebar collapse state, shared by the toggle in the header and the
 * sidebar column itself.
 *
 * Only these two pieces need to be interactive, so the rest of the shell stays
 * a server component. The state is per-browser (`localStorage`): an
 * administrator who prefers the wide content area keeps it between visits, and a
 * screen narrower than `lg` never sees the rail (the sidebar is already a chip
 * strip there), so the value is only read at `lg` and up.
 *
 * SSR renders expanded; `useEffect` adopts the stored preference on mount. That
 * is a one-frame correction on a control that is off-screen below `lg` anyway,
 * and it keeps the server markup deterministic.
 */
const STORAGE_KEY = 'bribar.sidebar.collapsed';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Adopt the stored preference once, on mount. SSR always renders expanded,
    // so this is the one place the two can legitimately differ — the same
    // "mirror an external source" pattern `SearchBar` uses for the URL.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      // Private mode or blocked storage — expanded is a fine default.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Non-fatal: the preference just will not persist.
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext);
  // Rendered outside the provider (e.g. the mobile chip strip reuses
  // `AdminSidebar` markup): treat that as permanently expanded.
  return context ?? { collapsed: false, toggle: () => {} };
}

/**
 * The sidebar column. Owns the width so the collapse animates the layout, not
 * just the nav's contents.
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        'bg-sidebar border-sidebar-border hidden shrink-0 border-r transition-[width] duration-200 lg:block',
        collapsed ? 'lg:w-18' : 'lg:w-64',
      )}
    >
      {children}
    </div>
  );
}

/** The three-line control in the admin header. */
export function SidebarToggleButton() {
  const { collapsed, toggle } = useSidebar();

  return (
    <Button
      type="button"
      onClick={toggle}
      variant="ghost"
      size="icon"
      aria-label={UI.nav.toggleSidebar}
      aria-expanded={!collapsed}
      title={UI.nav.toggleSidebar}
      className="text-muted-foreground -ml-2 size-9 rounded-lg"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.22386 1.22386 11 1.5 11H13.5C13.7761 11 14 11.22386 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </Button>
  );
}
