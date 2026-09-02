/**
 * 404 (SRS 17.4).
 *
 * Also what a driver sees when they open a service that is not theirs — the
 * repository scopes by owner, so a foreign record is indistinguishable from a
 * missing one, which is what SRS 24.3 requires.
 */
import Link from 'next/link';

import { UI } from '@/lib/i18n/messages';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="text-xl font-semibold tracking-tight">{UI.errors.notFoundTitle}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">{UI.errors.notFoundHint}</p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary-hover mt-2 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium transition-colors"
      >
        {UI.errors.backHome}
      </Link>
    </main>
  );
}
