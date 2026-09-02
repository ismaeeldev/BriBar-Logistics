'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV, isCurrent } from '@/components/layout/nav-items';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Administrator navigation, in two genuinely different forms.
 *
 * **Below `lg`: a horizontal strip of chips** under the header, scrolling
 * sideways if it must. Five destinations do not fit across a phone, and a
 * hamburger would hide the whole information architecture behind a tap.
 *
 * **At `lg` and above: a fixed sidebar.** SRS 23.2 asks admin screens to "use
 * available desktop space effectively", and on a 1400px monitor a horizontal
 * strip wastes the entire left margin while the eye still has to travel up to
 * find it. A sidebar puts every section permanently in view and lets the
 * content column start where the reader is already looking.
 *
 * An earlier version used the strip at every width. That was the right call
 * when the content was cards; it stopped being right once these screens became
 * tables that want the horizontal room a sidebar frees up by moving navigation
 * out of the vertical flow.
 */
export function AdminNavMobile() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={UI.nav.adminLabel}
      className="bg-card/80 sticky top-14 z-10 border-b backdrop-blur-sm lg:hidden"
    >
      <div className="no-scrollbar mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-2">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isCurrent(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={UI.nav.adminLabel}
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 border-r px-3 py-5 lg:block"
    >
      <ul className="space-y-1">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isCurrent(pathname, href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
