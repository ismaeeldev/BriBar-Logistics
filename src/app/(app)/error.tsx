'use client';

/**
 * Unexpected error scoped to the authenticated shell (SRS 17.4, 24.5).
 *
 * Without this, the only boundary was the root `error.tsx`, which sits above
 * `AuthenticatedLayout` — so a render error on any admin or driver page tore
 * down `AppShell` (nav, header, everything) along with the page, not just the
 * page. That made an ordinary "list page failed to render after a successful
 * write" look like the whole app had crashed. Scoping the boundary here keeps
 * `AppShell` mounted and contains the crash to the content area, exactly as
 * `error.tsx` is designed to nest (see `app/error.tsx` for the copy/behaviour
 * this mirrors).
 */
import { useEffect } from 'react';

import { UI } from '@/lib/i18n/messages';

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error', error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{UI.errors.errorTitle}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">{UI.errors.errorHint}</p>
      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">
          {UI.errors.reference} {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary-hover mt-2 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium transition-colors"
      >
        {UI.errors.retry}
      </button>
    </div>
  );
}
