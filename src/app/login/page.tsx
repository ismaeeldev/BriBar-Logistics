/**
 * Sign-in (SRS 17.1).
 *
 * A server action rather than a client-side `signIn` call, so credentials are
 * posted straight to the server and never held in client component state.
 */
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { LoginSubmit } from '@/components/auth/login-submit';
import { LogoLockup } from '@/components/layout/logo';
import { Alert } from '@/components/ui/primitives';
import { signIn } from '@/lib/auth';
import { AUTH, FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { credentialsSchema } from '@/modules/users/schemas/user.schema';

export const metadata = { title: UI.auth.signIn };

/**
 * Auth.js signals a successful credentials sign-in by throwing a redirect, so
 * `redirect()` runs outside the try/catch — otherwise the success path is
 * caught and reported as a failure.
 */
async function signInAction(formData: FormData): Promise<void> {
  'use server';

  const parsed = credentialsSchema.safeParse({
    loginIdentifier: formData.get('loginIdentifier'),
    password: formData.get('password'),
  });

  if (!parsed.success) redirect('/login?error=credentials');

  try {
    await signIn('credentials', {
      loginIdentifier: parsed.data.loginIdentifier,
      password: parsed.data.password,
      // `/` routes the user to their role's dashboard.
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // SRS 17.1 asks for a distinct inactive-account state; SRS 22.1 forbids
      // exposing anything more. A code selects the message and nothing else —
      // no account name, no confirmation that one exists.
      const isInactive =
        'code' in error && (error as { code?: string }).code === 'account_inactive';

      redirect(`/login?error=${isInactive ? 'inactive' : 'credentials'}`);
    }
    throw error;
  }
}

const CONTROL =
  'w-full rounded-lg border border-input bg-card px-3 h-11 text-base ' +
  'placeholder:text-muted-foreground transition-colors';

const ERROR_MESSAGES: Record<string, string> = {
  credentials: AUTH.invalidCredentials,
  inactive: AUTH.accountInactive,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? AUTH.invalidCredentials) : null;

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-8">
        <header className="space-y-3 text-center">
          {/* The lockup already carries the company name, so it is the heading
              rather than decoration above one. */}
          <h1>
            <LogoLockup className="text-primary mx-auto h-24 w-52" />
            <span className="sr-only">{UI.common.appName}</span>
          </h1>
          <p className="text-muted-foreground text-sm">{UI.auth.internalAccess}</p>
        </header>

        <div className="bg-card rounded-xl border p-6 shadow-xs">
          <form action={signInAction} className="space-y-4">
            {message ? <Alert tone="error">{message}</Alert> : null}

            {/*
              Written out rather than using <Field>, which takes a render prop
              — a function cannot cross the server/client boundary, and this
              page is a server component so the sign-in action can stay inline.
              Two fields do not justify a client boundary.
            */}
            <div className="space-y-1.5">
              <label htmlFor="loginIdentifier" className="block text-sm font-medium">
                {FIELD_LABELS.loginIdentifier}
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
                autoFocus
                className={CONTROL}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                {FIELD_LABELS.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={CONTROL}
              />
            </div>

            <LoginSubmit />
          </form>
        </div>

        <p className="text-muted-foreground text-center text-xs">{UI.auth.forgotPassword}</p>
      </div>
    </main>
  );
}
