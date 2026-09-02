'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { UI } from '@/lib/i18n/messages';

/**
 * The sign-in button, with its own pending state.
 *
 * Split into a client component so the login page itself stays a server
 * component - `useFormStatus` only reports the status of the form it is
 * rendered inside, which is exactly the boundary wanted here.
 *
 * The feedback matters more than it looks: Argon2id verification is
 * deliberately slow (~50ms plus a round trip), so without it a driver on a poor
 * connection taps twice.
 */
export function LoginSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" block disabled={pending} className="mt-2">
      {pending ? (
        <>
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {UI.auth.checking}
        </>
      ) : (
        UI.auth.signIn
      )}
    </Button>
  );
}
