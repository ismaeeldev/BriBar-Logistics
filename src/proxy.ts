/**
 * Page-level route protection (SRS 8.3).
 *
 * Next.js 16 renamed this convention from `middleware` to `proxy`; the
 * behaviour and the runtime are the same.
 *
 * Runs on the Edge, so it imports `@/lib/auth/config` — the provider-free half
 * of the Auth.js configuration — rather than `@/lib/auth`, which pulls in
 * Prisma and the native Argon2 binding and cannot run here.
 *
 * This is the first gate, never the last. SRS 8.3 requires API routes to repeat
 * the same checks server-side, and they do: every handler calls `requireUser`
 * or `requireAdmin`, which re-read the database. A proxy that is bypassed,
 * misconfigured, or simply not matched by the pattern below must not be able to
 * grant access to anything.
 */
import NextAuth from 'next-auth';

import { authConfig } from '@/lib/auth/config';

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  /**
   * Everything except Next.js internals, the Auth.js callbacks themselves, and
   * static assets.
   *
   * API routes are deliberately included: an unauthenticated fetch should be
   * stopped here as well as in the handler. The handler's own check is what
   * makes the guarantee, but there is no reason to let the request reach it.
   */
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
