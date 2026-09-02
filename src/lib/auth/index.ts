/**
 * Auth.js instance for the Node runtime (SRS 8.1, 8.2, 22.1).
 *
 * This file adds the credentials provider to the Edge-safe configuration. It
 * imports Prisma and the Argon2 binding, so it must never be pulled into the
 * middleware bundle — import `@/lib/auth/config` there instead.
 */
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { verifyPassword } from '@/lib/auth/password';
import { authConfig } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { credentialsSchema } from '@/modules/users/schemas/user.schema';

/**
 * A real Argon2id hash of a random string, compared against when no user
 * matches the submitted identifier.
 *
 * Without it, a request for a non-existent account returns in microseconds
 * while a request for a real one takes ~50 ms of deliberate hashing. That
 * difference is measurable over a handful of requests and turns the login form
 * into an account-enumeration oracle — which SRS 22.1 ("login errors shall not
 * expose unnecessary account information") is precisely about.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$3Y8vQeR2sK9wLmXpZaBcDg$k7Hn2QvJ4pR8sT1uW3xY5zA6bC9dE0fG2hI4jK6lM8o';

/**
 * Signals a correct password on a deactivated account (SRS 8.1 AUTH-005,
 * 17.1).
 *
 * The order of checks in `authorize` matters: the password is verified *before*
 * the active flag is consulted, so "this account is disabled" is only ever
 * shown to someone who already proved they hold the credential. Someone
 * guessing identifiers gets the same generic failure either way.
 */
export class InactiveAccountError extends CredentialsSignin {
  override code = 'account_inactive';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        loginIdentifier: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },

      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const loginIdentifier = parsed.data.loginIdentifier.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { loginIdentifier },
          // Explicit select rather than the whole row: it keeps the password
          // hash out of anything that might later be logged or returned, and
          // documents exactly what authentication needs (SRS 22.1).
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        // Constant-ish work whether or not the account exists.
        const passwordMatches = await verifyPassword(
          user?.passwordHash ?? DUMMY_HASH,
          parsed.data.password,
        );

        if (!user || !passwordMatches) {
          logger.warn('Failed sign-in attempt', { loginIdentifier });
          return null;
        }

        if (!user.isActive) {
          logger.warn('Sign-in blocked for deactivated account', {
            userId: user.id,
            loginIdentifier,
          });
          throw new InactiveAccountError();
        }

        logger.info('Sign-in succeeded', { userId: user.id, role: user.role });

        // Whatever is returned here reaches the `jwt` callback. The password
        // hash is deliberately not among it.
        return { id: user.id, name: user.name, role: user.role };
      },
    }),
  ],
});
