/**
 * Auth.js configuration that is safe to run on the Edge runtime.
 *
 * Auth.js v5 is used in two places with different capabilities. Next.js
 * middleware runs on the Edge, where there is no Node runtime and therefore no
 * Prisma and no native Argon2 binding. Route handlers and server components run
 * on Node, where both are available.
 *
 * So the configuration is split. This file holds everything the middleware
 * needs — the session strategy, the callbacks that shape the token, and the
 * route-protection rules — and deliberately contains **no provider**, no
 * database import and no password hashing. `src/lib/auth/index.ts` adds the
 * credentials provider and is imported only from Node contexts.
 *
 * Getting this split wrong is the classic Auth.js v5 failure: the middleware
 * bundle pulls in Prisma, the Edge build fails, and the usual "fix" is to move
 * authorisation out of the middleware entirely. The split keeps both.
 */
import type { NextAuthConfig } from 'next-auth';

import { env } from '@/lib/env';
import { Role } from '@/modules/services/domain/service-status';

const DAY_IN_SECONDS = 24 * 60 * 60;

/** Paths reachable without a session (SRS 8.1). */
const PUBLIC_PATHS = ['/login'];

/** Prefixes that require the ADMIN role (SRS 8.3). */
const ADMIN_PATHS = ['/admin'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const authConfig = {
  // SRS 22.5: read from the validated configuration, never from a literal.
  secret: env.AUTH_SECRET,

  /**
   * Required when self-hosting.
   *
   * Auth.js verifies the request host against its own expectation and refuses
   * the session when they differ, which is the right default for a deployment
   * behind an unknown proxy. SRS 4.4 puts this on BRIBAR's own private
   * subdomain, behind whatever reverse proxy the host provides, so the header
   * is trusted here and `AUTH_URL` pins the canonical origin instead.
   *
   * Without it the symptom is confusing rather than obvious: sign-in succeeds
   * and sets a cookie, then every subsequent request reports no session.
   */
  trustHost: true,

  /**
   * JWT rather than a database session table.
   *
   * The credentials provider requires it — Auth.js does not support database
   * sessions with credentials — and it also means the middleware can authorise
   * a request on the Edge without a database round trip.
   *
   * The cost is that the token is a snapshot. A user deactivated mid-session
   * still holds a valid token until it expires, so `requireUser` re-reads
   * `isActive` from the database on every protected request (SRS 8.3, 12.4).
   * The token is a routing hint; the database is the authority.
   */
  session: {
    strategy: 'jwt',
    maxAge: env.SESSION_MAX_AGE_DAYS * DAY_IN_SECONDS,
  },

  jwt: {
    maxAge: env.SESSION_MAX_AGE_DAYS * DAY_IN_SECONDS,
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Filled in by src/lib/auth/index.ts, which runs on Node.
  providers: [],

  callbacks: {
    /**
     * Copies the identity onto the token at sign-in.
     *
     * Only what routing decisions need: id, role and display name. No email, no
     * password hash, nothing that would be a leak if the token were read — a
     * JWT is signed, not encrypted, and its payload is readable by anyone
     * holding it.
     */
    jwt({ token, user }) {
      if (user) {
        if (user.id) token.sub = user.id;
        // Bracket access, and a cast on the way back out below: Auth.js types
        // the JWT with an index signature of `unknown`, which our module
        // augmentation widens rather than replaces.
        token['role'] = user.role;
        if (user.name) token.name = user.name;
      }
      return token;
    },

    /** Projects the token onto the session object the application sees. */
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;

      const role = token['role'];
      if (role === Role.ADMIN || role === Role.DRIVER) {
        session.user.role = role;
      }

      if (typeof token.name === 'string') session.user.name = token.name;
      return session;
    },

    /**
     * Page-level route protection, evaluated in middleware (SRS 8.3).
     *
     * This is the first gate, not the only one. It stops an unauthenticated
     * browser reaching a page and redirects it somewhere sensible, but SRS 8.3
     * requires that "API routes must repeat the same authorization checks
     * server-side" — so every route handler and every service call re-checks
     * independently. Middleware that is bypassed, misconfigured, or simply not
     * matched must not be able to grant access.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      // Public paths (`/login`) are always reachable, even with a session.
      //
      // The middleware runs on the Edge and only checks the JWT's signature;
      // `requireUser` runs on Node and re-reads the database, so a token that
      // decodes here can still be rejected there — the account was
      // deactivated or deleted, or the database was restored from a point
      // before the account existed (which is exactly what a fresh cutover
      // looks like). When that happens the authenticated layout redirects to
      // `/login`, and if this middleware bounced a "signed-in" user straight
      // back to their dashboard the two would loop forever. Letting `/login`
      // render lets them sign in again and replace the stale token.
      if (isPublicPath(pathname)) return true;

      // Returning false makes Auth.js redirect to `pages.signIn` with a
      // callbackUrl, so the user lands where they were headed after logging in.
      if (!user) return false;

      if (isAdminPath(pathname) && user.role !== Role.ADMIN) {
        // SRS 24.3: do not reveal what lives behind an admin URL. A driver is
        // redirected to their own dashboard rather than shown a 403 describing
        // the page they cannot see.
        return Response.redirect(new URL('/driver', request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
