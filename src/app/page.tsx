/**
 * Application entry point (SRS 17.1, `/`).
 *
 * "Redirect unauthenticated users to /login; redirect authenticated users to
 * their role-appropriate dashboard."
 *
 * Phase 1 delivers the data model and the server-side foundation, so there is
 * no session to read yet. This page therefore honours the only half of the
 * rule it can today - send everyone to /login - and the role branch arrives
 * with authentication in Phase 2. The placeholder is deliberately narrow: the
 * redirect target does not change when the session check is added, only the
 * condition around it.
 */
import { redirect } from 'next/navigation';

export default function Home(): never {
  redirect('/login');
}
