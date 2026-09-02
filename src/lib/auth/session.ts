/**
 * The authorisation gate every protected operation passes through
 * (SRS 8.3, 12.4, 22.3).
 *
 * ## Why these re-read the database
 *
 * The session is a signed JWT, so its contents are a snapshot taken at sign-in.
 * If authorisation trusted it alone, an administrator deactivating a driver
 * would not take effect until that driver's token expired — up to twenty days
 * later (`docs/open-questions.md` #9). SRS 12.4 says deactivation "shall
 * prevent future login/use", and *use* is the operative word.
 *
 * So each helper below re-reads the user's current role and active flag. The
 * token says who is asking; the database says whether they may.
 *
 * That is one indexed primary-key lookup per protected request. For a system
 * sized at "approximately two users" growing to a fleet (SRS 3.3), the cost is
 * irrelevant and the alternative is a documented security hole.
 *
 * ## Why they throw
 *
 * Every one returns a non-null actor or throws. There is no `getUserOrNull`
 * that a caller might forget to check — a missing authorisation check should be
 * impossible to write, not merely discouraged. `withRouteHandler` turns the
 * throw into the right status code.
 */
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { forbidden, unauthenticated } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { Role, type ServiceActor } from '@/modules/services/domain/service-status';

/**
 * The authenticated user, as the application layer sees them.
 *
 * Structurally a `ServiceActor` (`userId` + `role`), so it can be passed
 * straight to the domain predicates in `service-status.ts` without adapting.
 */
export interface Actor extends ServiceActor {
  userId: string;
  name: string;
  role: Role;
}

/**
 * The current user, verified against the database.
 *
 * @throws 401 when there is no session, or the session names a user who has
 *         since been deleted or deactivated.
 */
export async function requireUser(): Promise<Actor> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) throw unauthenticated();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  // A token naming a user who no longer exists is not a 404 — from the
  // caller's point of view they are simply not signed in.
  if (!user) throw unauthenticated();

  // SRS 8.1 AUTH-005 and 12.4. Deliberately 401 rather than 403: the correct
  // remedy is to sign in again as someone else, and the client should clear
  // the stale session rather than treat it as a permission problem.
  if (!user.isActive) throw unauthenticated(ERRORS.accountInactive);

  return { userId: user.id, name: user.name, role: user.role };
}

/**
 * The current user, who must be an administrator (SRS 8.3, 22.3).
 *
 * @throws 401 when unauthenticated, 403 when signed in as a driver.
 */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireUser();
  if (actor.role !== Role.ADMIN) throw forbidden();
  return actor;
}

/**
 * The current user, who must be a driver.
 *
 * Used only where a driver-specific configuration is needed — the Add Service
 * context reads a default vehicle and assigned routes, neither of which an
 * administrator has. Endpoints that merely *allow* a driver should use
 * `requireUser` and let the domain predicates decide, so that adding a future
 * role does not mean revisiting every handler.
 */
export async function requireDriver(): Promise<Actor> {
  const actor = await requireUser();
  if (actor.role !== Role.DRIVER) throw forbidden();
  return actor;
}

/**
 * The current user, or `null` — for rendering decisions only.
 *
 * Never use this to gate an action. It exists so a layout can show a name in
 * the header without a redirect, and it does not verify `isActive`.
 */
export async function getOptionalActor(): Promise<Actor | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
