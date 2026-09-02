import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminNavMobile, AdminSidebar } from '@/components/layout/admin-nav';
import { DriverNavDesktop, DriverNavMobile } from '@/components/layout/driver-nav';
import { LogoMark } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';
import type { Actor } from '@/lib/auth/session';
import { ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { Role } from '@/modules/services/domain/service-status';

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
export function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const isAdmin = actor.role === Role.ADMIN;
  const home = isAdmin ? '/admin' : '/driver';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card/80 sticky top-0 z-20 border-b backdrop-blur-sm">
        <div
          className={cn(
            'mx-auto flex h-14 w-full items-center justify-between gap-3 px-4',
            isAdmin ? 'max-w-7xl' : 'max-w-3xl',
          )}
        >
          {/*
            On an admin desktop this block is exactly the sidebar's width and
            carries the sidebar's rule, so one unbroken vertical line runs from
            the top of the window to the bottom of the page and the logo sits
            in the same column as the navigation it heads.
          */}
          <div
            className={cn(
              'flex h-full min-w-0 items-center gap-5',
              isAdmin && 'lg:w-56 lg:shrink-0 lg:border-r lg:pl-6',
            )}
          >
            <Link
              href={home}
              className="text-primary flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <LogoMark className="h-7 w-[2.35rem]" />
              {/* The wordmark is dropped on the narrowest screens: the mark
                  identifies the app, and the room is better spent on the
                  page's own title. */}
              <span className="text-foreground hidden truncate text-sm font-semibold tracking-tight min-[420px]:inline">
                {UI.common.appName}
              </span>
            </Link>

            {!isAdmin ? <DriverNavDesktop /> : null}
          </div>

          <div
            className={cn(
              'flex items-center gap-2',
              isAdmin && 'lg:flex-1 lg:justify-end lg:pl-6',
            )}
          >
            {/* Available at every width. A driver reading a route sheet in a
                dark cab has more use for this than an administrator does. */}
            <ThemeToggle />

            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{actor.name}</p>
              <p className="text-muted-foreground text-xs leading-tight">
                {ROLE_LABELS[actor.role]}
              </p>
            </div>

            {/*
              A form posting to a server action, not a link. Sign-out is a state
              change, so it must be a POST — a GET link would let any page on
              the internet log the user out with an <img> tag.
            */}
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
                aria-label={UI.common.signOut}
                title={UI.common.signOut}
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      {isAdmin ? <AdminNavMobile /> : null}

      <div
        className={cn(
          'mx-auto flex w-full flex-1',
          isAdmin ? 'max-w-7xl gap-6 lg:px-4' : 'max-w-3xl',
        )}
      >
        {isAdmin ? <AdminSidebar /> : null}

        <main
          className={cn(
            'min-w-0 flex-1 px-4 py-6',
            isAdmin ? 'lg:px-0 lg:py-8' : 'pb-24 sm:pb-8',
          )}
        >
          {children}
        </main>
      </div>

      {!isAdmin ? <DriverNavMobile /> : null}
    </div>
  );
}
