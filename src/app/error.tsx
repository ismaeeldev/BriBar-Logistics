'use client';

/**
 * Unexpected server error (SRS 17.4, 24.5).
 *
 * "Users receive a generic safe error message; technical details are logged
 * server-side, not exposed in the browser." The `error` prop carries only a
 * digest in production - Next.js strips the message and stack before it reaches
 * the client - and even that is shown only as a reference the user can quote to
 * whoever checks the logs.
 */
import { useEffect } from 'react';

import { UI } from '@/lib/i18n/messages';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the browser console only; the server has already logged the real
    // error with its stack.
    console.error('Unhandled application error', error.digest);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
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
    </main>
  );
}
