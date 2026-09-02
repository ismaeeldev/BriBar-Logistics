/**
 * Sign-in (SRS 17.1).
 *
 * Phase 2 delivers the authentication behaviour; Phase 3 designs the interface.
 * This page is therefore plain, but it is not a placeholder — every requirement
 * SRS 17.1 lists is present and working: the application identity, both fields,
 * the submit action, and distinct error states for invalid credentials and a
 * deactivated account.
 *
 * A server action rather than a client-side `signIn` call, so the credentials
 * are posted directly to the server and never held in client component state.
 */
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/lib/auth';
import { AUTH } from '@/lib/i18n/messages';
import { credentialsSchema } from '@/modules/users/schemas/user.schema';

export const metadata = { title: 'Iniciar sesión' };

/**
 * Auth.js signals a successful credentials sign-in by throwing a redirect, so
 * `redirect()` has to run outside the try/catch that handles auth failures —
 * otherwise the success path is caught and reported as an error.
 */
async function signInAction(formData: FormData): Promise<void> {
  'use server';

  const parsed = credentialsSchema.safeParse({
    loginIdentifier: formData.get('loginIdentifier'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect('/login?error=credentials');
  }

  try {
    await signIn('credentials', {
      loginIdentifier: parsed.data.loginIdentifier,
      password: parsed.data.password,
      // The middleware routes the user to their dashboard from here.
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // SRS 17.1 asks for a distinct inactive-account state; SRS 22.1 forbids
      // exposing anything more. The code says which message to show and
      // nothing else — no account name, no confirmation that it exists.
      const code = error.type === 'CredentialsSignin' ? 'credentials' : 'unknown';
      const isInactive =
        'code' in error && (error as { code?: string }).code === 'account_inactive';

      redirect(`/login?error=${isInactive ? 'inactive' : code}`);
    }

    // A redirect thrown by a successful sign-in. Re-thrown so Next.js can act
    // on it.
    throw error;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  credentials: AUTH.invalidCredentials,
  inactive: AUTH.accountInactive,
  unknown: AUTH.invalidCredentials,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? AUTH.invalidCredentials) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">BRIBAR Logistics</h1>
        <p className="text-sm text-neutral-600">Acceso interno</p>
      </header>

      <form action={signInAction} className="space-y-4">
        {message ? (
          // `role="alert"` so a screen reader announces the failure without the
          // user having to hunt for it (SRS 23.10).
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {message}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="loginIdentifier" className="block text-sm font-medium">
            Usuario
          </label>
          <input
            id="loginIdentifier"
            name="loginIdentifier"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </div>

        {/* Large touch target, per SRS 23.3 - drivers sign in on a phone. */}
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white"
        >
          Iniciar sesión
        </button>
      </form>
    </main>
  );
}
