import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminNavMobile, AdminSidebar } from '@/components/layout/admin-nav';
import { DriverNavDesktop, DriverNavMobile } from '@/components/layout/driver-nav';
import { LogoMark } from '@/components/layout/logo';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';
import type { Actor } from '@/lib/auth/session';
import { ROLE_LABELS, UI, LOCALE } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { Role } from '@/modules/services/domain/service-status';
import { env } from '@/lib/env';
import { currentBusinessDate, formatLongBusinessDate } from '@/lib/time/business-date';

/**
 * The chrome every authenticated page sits inside.
 *
 * The two roles get different layouts because they are used on different
 * machines for different lengths of time. A driver opens this on a phone,
 * standing up, to record one service; an administrator sits at a desk and works
 * through a queue. Serving both from one layout means serving neither well.
 *
 *   Driver      narrow column, bottom tab bar on a phone, header links above
 *               `sm`. The content is a form, so the column stays readable
 *               rather than stretching across a monitor.
 *
 *   Admin       full width with a sidebar from `lg` up, chip strip below it.
 *               These screens are tables and charts, and SRS 23.2 asks them to
 *               use the desktop space they are given.
 *
 * Both navigations render in the markup and CSS decides which is visible, so
 * there is no layout shift on load and no JavaScript in the decision.
 */
function GlobalHeader({
  actor,
  isAdmin,
  home,
  className,
}: {
  actor: Actor;
  isAdmin: boolean;
  home: string;
  className?: string;
}) {
  return (
    <header className={cn("bg-card/80 sticky top-0 z-20 border-b backdrop-blur-sm", className)}>
      <div
        className={cn(
          'mx-auto flex h-14 w-full items-center justify-between gap-3 px-4',
          isAdmin ? 'max-w-7xl' : 'max-w-3xl',
        )}
      >
        <div
          className={cn(
            'flex h-full min-w-0 items-center gap-5',
            isAdmin && 'lg:pl-2',
          )}
        >
          {/* Logo only shown in mobile admin header or global driver header */}
          <Link
            href={home}
            className="text-primary flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <LogoMark className="h-7 w-[2.35rem]" />
            <span className="text-foreground hidden truncate text-sm font-semibold tracking-tight min-[420px]:inline">
              {UI.common.appName}
            </span>
          </Link>
          {!isAdmin ? <DriverNavDesktop /> : null}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell role={actor.role} />
          <ThemeToggle />
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-medium">{actor.name}</p>
            <p className="text-muted-foreground text-xs leading-tight">
              {ROLE_LABELS[actor.role]}
            </p>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="ghost" size="icon" aria-label={UI.common.signOut} title={UI.common.signOut}>
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const isAdmin = actor.role === Role.ADMIN;
  const home = isAdmin ? '/admin' : '/driver';

  return (
    <div className={cn("flex h-dvh overflow-hidden", isAdmin ? "flex-col lg:flex-row" : "flex-col")}>

      {/* Mobile/Driver Header */}
      <GlobalHeader actor={actor} isAdmin={isAdmin} home={home} className={isAdmin ? "lg:hidden" : ""} />

      {isAdmin ? <AdminNavMobile /> : null}

      {/* Desktop Admin Sidebar (Full Height) */}
      {isAdmin ? (
        <div className="hidden lg:block w-64 shrink-0 bg-sidebar border-r border-sidebar-border">
          <AdminSidebar actor={actor} />
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className={cn("flex flex-1 flex-col min-w-0 overflow-y-auto", isAdmin ? "bg-muted/30" : "")}>

        {/* Desktop Admin Header */}
        {isAdmin ? (
          <header className="bg-card/80 border-border sticky top-0 z-20 hidden h-16 shrink-0 items-center justify-between border-b px-6 backdrop-blur-sm lg:flex">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-muted-foreground -ml-2 size-9 rounded-lg">
                <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.22386 1.22386 11 1.5 11H13.5C13.7761 11 14 11.22386 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
              </Button>
              <div className="flex flex-col justify-center">
                <h1 className="text-foreground text-sm leading-tight font-semibold">
                  {UI.driver.greeting(actor.name.split(' ')[0] ?? actor.name)} <span aria-hidden>👋</span>
                </h1>
                <p className="text-muted-foreground text-xs leading-tight">
                  {formatLongBusinessDate(currentBusinessDate(env.APP_TIMEZONE), LOCALE)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell role={actor.role} />
              <ThemeToggle />

              <div className="bg-border mx-1 h-6 w-px" />

              <div className="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1">
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                  {actor.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-foreground text-[13px] leading-tight font-semibold">{actor.name}</p>
                  <p className="text-muted-foreground text-[11px] leading-tight">
                    {ROLE_LABELS[actor.role]}
                  </p>
                </div>
              </div>

              <div className="bg-border mx-1 h-6 w-px" />

              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-9 rounded-lg"
                  aria-label={UI.common.signOut}
                  title={UI.common.signOut}
                >
                  <LogOut aria-hidden className="size-4.5" />
                </Button>
              </form>
            </div>
          </header>
        ) : null}

        <main
          className={cn(
            'flex-1 mx-auto w-full py-5',
            isAdmin ? 'px-6 lg:px-6' : 'px-4 max-w-3xl pb-24 sm:pb-8',
          )}
        >
          {children}
        </main>
      </div>

      {!isAdmin ? <DriverNavMobile /> : null}
    </div>
  );
}
