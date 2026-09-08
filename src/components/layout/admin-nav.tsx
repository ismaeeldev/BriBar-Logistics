'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV, ADMIN_SECTIONS, isCurrent } from '@/components/layout/nav-items';
import { LogoMark } from '@/components/layout/logo';
import { useSidebar } from '@/components/layout/sidebar-state';
import { UI, ROLE_LABELS } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import type { Actor } from '@/lib/auth/session';

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

export function AdminSidebar({ actor }: { actor?: Actor }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <nav
      aria-label={UI.nav.adminLabel}
      className="glow-sidebar bg-sidebar-gradient text-sidebar-foreground sticky top-0 hidden h-dvh w-full shrink-0 flex-col border-r border-white/[0.06] py-6 lg:flex"
    >
      <div
        className={cn(
          'relative z-10 mb-8 flex items-center gap-3',
          collapsed ? 'justify-center px-2' : 'px-6',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
          <LogoMark className="text-primary h-full w-full" />
        </span>
        {!collapsed ? (
          <span className="text-xl font-bold tracking-tight text-white">{UI.common.appName}</span>
        ) : null}
      </div>

      <div
        className={cn(
          'relative z-10 flex-1 space-y-5 overflow-y-auto no-scrollbar',
          collapsed ? 'px-2' : 'px-4',
        )}
      >
        {ADMIN_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <p className="text-sidebar-foreground/60 mb-2 px-3 text-[0.7rem] font-bold uppercase tracking-wider">
                {section.label}
              </p>
            ) : null}

            <ul className="space-y-1">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isCurrent(pathname, href);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-[14px] py-3 text-[15px] font-semibold transition-all duration-200',
                        collapsed ? 'justify-center px-0' : 'px-4',
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_16px_-4px_rgba(59,130,246,0.55)]'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      {active && !collapsed ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-1 rounded-full bg-white/90"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          'size-[22px] shrink-0 transition-colors',
                          active ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'
                        )}
                      />
                      {!collapsed ? <span className="truncate">{label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {actor && (
        <div className={cn('relative z-10 mt-auto', collapsed ? 'px-2' : 'px-4')}>
          <div
            className={cn(
              'border-sidebar-border/60 flex items-center gap-3 rounded-xl border bg-white/[0.04] p-3',
              collapsed && 'justify-center',
            )}
          >
            <div className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm">
              {actor.name.substring(0, 2).toUpperCase()}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{actor.name}</p>
                <p className="text-sidebar-foreground/60 truncate text-xs">
                  {ROLE_LABELS[actor.role] || actor.role}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  );
}
