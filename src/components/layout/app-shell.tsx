import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminNav } from '@/components/layout/admin-nav';
import { signOut } from '@/lib/auth';
import type { Actor } from '@/lib/auth/session';
import { ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { Role } from '@/modules/services/domain/service-status';

import { Button } from '@/components/ui/button';

/**
 * The chrome every authenticated page sits inside.
 *
 * A single sticky header rather than a sidebar. The driver workflow is three
 * screens deep at most, and a sidebar on a phone means a hamburger, a drawer
 * and a focus trap — machinery that buys nothing when the whole navigation is
 * two links.
 */
export function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const home = actor.role === Role.ADMIN ? '/admin' : '/driver';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card/80 sticky top-0 z-20 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <BribarMark />
            <span className="truncate text-sm font-semibold tracking-tight">
              {UI.common.appName}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{actor.name}</p>
              <p className="text-muted-foreground text-xs leading-tight">
                {ROLE_LABELS[actor.role]}
              </p>
            </div>

            {/*
              A form posting to a server action, not a client-side handler.
              Sign-out is a state change, so it must be a POST — a GET link
              would let any page on the internet log the user out with an
              <img> tag.
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

      {/* Administrators have four sections to move between; a driver has one
          screen and needs no navigation at all (SRS 15.1). */}
      {actor.role === Role.ADMIN ? <AdminNav /> : null}

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}

/** A simple geometric mark — no external asset to load or go missing. */
function BribarMark() {
  return (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-[0.6875rem] font-bold tracking-tight"
    >
      BL
    </span>
  );
}
