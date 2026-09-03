'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV, ADMIN_SECTIONS, isCurrent } from '@/components/layout/nav-items';
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
                'relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
              {active ? (
                <span
                  aria-hidden
                  className="bg-primary animate-sweep absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full"
                />
              ) : null}
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
      // `pl-3` matches the header's logo indent, so the icons below line up
      // with the mark above them; `pr-4` keeps the active pill off the rule.
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 border-r py-6 pr-4 pl-3 lg:block"
    >
      {/*
        Grouped, and the groups are labelled. The selected item used to be a
        filled brand-blue pill, which competed with the content for the eye's
        attention every time the page loaded — on an operations screen the
        navigation should be findable, not loud. It is now a neutral ground
        with a brand rule down its left edge: still unambiguous, and it stops
        the blue from being the first thing anyone sees.
      */}
      <div className="space-y-5">
        {ADMIN_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-muted-foreground mb-1 px-3 text-[0.65rem] font-semibold tracking-wider uppercase">
              {section.label}
            </p>

            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isCurrent(pathname, href);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md py-2 pr-3 pl-3.5 text-sm transition-colors duration-200',
                        active
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {/* The rule, not a fill: it marks the current page a
                          second way so the ground is not carrying it alone. */}
                      {active ? (
                        <span
                          aria-hidden
                          className="bg-primary animate-grow absolute top-1.5 bottom-1.5 left-0 w-[3px] origin-center rounded-full"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          active && 'text-primary',
                        )}
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
