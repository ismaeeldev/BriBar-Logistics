/**
 * Application entry point (SRS 17.1, `/`).
 *
 * "Redirect unauthenticated users to /login; redirect authenticated users to
 * their role-appropriate dashboard."
 */
import { redirect } from 'next/navigation';

import { getOptionalActor } from '@/lib/auth/session';
import { Role } from '@/modules/services/domain/service-status';

export default async function Home(): Promise<never> {
  const actor = await getOptionalActor();

  if (!actor) redirect('/login');
  redirect(actor.role === Role.ADMIN ? '/admin' : '/driver');
}
