/**
 * Layout for every authenticated page.
 *
 * `requireUser` runs once here rather than in each page. It re-reads the user
 * from the database, so a session belonging to a deactivated account is
 * rejected at the shell before any page renders (SRS 8.3, 12.4) — the proxy's
 * check is a routing convenience, this one is the guarantee.
 *
 * Pages still call `requireDriver` / `requireAdmin` where a role matters. The
 * duplication is intentional: a page must not depend on a layout for its
 * authorisation, because a layout can be changed without the page noticing.
 */
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { getOptionalActor } from '@/lib/auth/session';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const actor = await getOptionalActor();

  if (!actor) redirect('/login');

  return <AppShell actor={actor}>{children}</AppShell>;
}
