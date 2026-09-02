/**
 * The service state machine and the permissions that hang off it
 * (SRS 11, 20, Appendix B).
 *
 * V1 has two states, which is small enough that the rules could be inlined at
 * each call site as `status === 'PENDING_APPROVAL'`. They are not, for two
 * reasons.
 *
 * First, SRS 21.2 requires the design to admit further states without a
 * redesign. A rejection state, or a two-stage approval, becomes an entry in
 * the transition table below plus a predicate change - not a hunt through
 * route handlers for every place a status was compared.
 *
 * Second, SRS 11.5 and Appendix B 34.3 are emphatic that the edit lock is an
 * authorisation rule, not a hidden button. Naming the rule once, here, means
 * the API and the UI ask the same function rather than each reimplementing it,
 * and the two cannot drift apart.
 *
 * Pure and framework-free: no Prisma, no session, no request. Callers pass the
 * facts in.
 */

/** Mirrors the `ServiceStatus` enum in the Prisma schema. */
export const ServiceStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

/** Mirrors the `Role` enum in the Prisma schema (SRS 8.2). */
export const Role = {
  ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/**
 * Permitted transitions (SRS 34.1).
 *
 * `APPROVED` is terminal in V1: SRS 11.4 forbids returning a service to
 * pending, and 29 excludes a rejection workflow.
 */
export const SERVICE_TRANSITIONS: Readonly<Record<ServiceStatus, readonly ServiceStatus[]>> =
  Object.freeze({
    [ServiceStatus.PENDING_APPROVAL]: Object.freeze([ServiceStatus.APPROVED]),
    [ServiceStatus.APPROVED]: Object.freeze([]),
  });

export function canTransition(from: ServiceStatus, to: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[from].includes(to);
}

/** The facts an authorisation decision about one service depends on. */
export interface ServiceActor {
  userId: string;
  role: Role;
}

export interface ServiceSubject {
  driverId: string;
  status: ServiceStatus;
}

/**
 * SRS 9.7: a driver sees only their own services; an admin sees all of them.
 *
 * Repositories additionally scope driver queries by `driverId` in SQL, so a
 * foreign record is never fetched in the first place and a direct URL guess
 * yields 404 rather than 403 (SRS 8.3, 24.3). This predicate guards the paths
 * where a record was already loaded for another reason.
 */
export function canView(actor: ServiceActor, subject: ServiceSubject): boolean {
  return actor.role === Role.ADMIN || actor.userId === subject.driverId;
}

/**
 * SRS 11.2, 11.4 and Appendix B 34.2.
 *
 * A driver may edit their own service only while it is pending. An
 * administrator may edit any service in any state, including after approval,
 * and doing so does not restore the driver's access - which falls out of this
 * function taking the actor's role rather than a mutable per-service flag.
 */
export function canEdit(actor: ServiceActor, subject: ServiceSubject): boolean {
  if (actor.role === Role.ADMIN) return true;
  if (actor.userId !== subject.driverId) return false;
  return subject.status === ServiceStatus.PENDING_APPROVAL;
}

/** SRS 11.3: only an administrator, and only from `PENDING_APPROVAL`. */
export function canApprove(actor: ServiceActor, subject: ServiceSubject): boolean {
  return actor.role === Role.ADMIN && canTransition(subject.status, ServiceStatus.APPROVED);
}

/** Terminal states have no outstanding work; used to shape list badges. */
export function isTerminal(status: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[status].length === 0;
}

/** Client-facing labels, kept in the client's own terminology (SRS 23.3). */
export const SERVICE_STATUS_LABELS: Readonly<Record<ServiceStatus, string>> = Object.freeze({
  [ServiceStatus.PENDING_APPROVAL]: 'Pending Approval',
  [ServiceStatus.APPROVED]: 'Approved',
});
