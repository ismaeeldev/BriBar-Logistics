/**
 * Translates Prisma's error codes into the application's error taxonomy.
 *
 * This lives in the data-access layer on purpose. It is the only module
 * outside repositories that needs to know Prisma exists, which keeps the HTTP
 * wrapper and the service layer free of ORM specifics (SRS 4.2, 30.1).
 *
 * Only constraint violations that represent a *race* are translated. A unique
 * violation the application should have prevented - submitting a duplicate
 * vehicle plate, say - is still worth reporting as a clean 409 rather than a
 * 500, because the pre-check and the insert are not atomic and a concurrent
 * request can always slip between them.
 */
import { Prisma } from '@prisma/client';

import {
  type AppError,
  businessRuleViolation,
  conflict,
  notFound,
} from '@/lib/errors/app-error';

/** Constraint names created by the initial migration, mapped to plain English. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  users_login_identifier_key: 'That login identifier is already in use.',
  vehicles_registration_plate_key: 'That registration plate is already registered.',
  routes_code_key: 'That route code is already in use.',
  services_service_code_key: 'That Service ID was already issued. Please submit again.',
  driver_routes_driver_id_route_id_key: 'That route is already assigned to this driver.',
  driver_routes_one_default_per_driver: 'A driver can only have one default route.',
  services_mileage_sequence: 'Odometer readings must not decrease across the route.',
  services_mileage_non_negative: 'Odometer readings cannot be negative.',
  services_actual_km_formula: 'Actual Km must equal End Dashboard KM minus Start Dashboard KM.',
  services_service_km_formula: 'Service Km must equal End Base KM minus Start Base KM.',
  services_service_km_within_actual: 'Service Km cannot exceed Actual Km.',
  services_approval_metadata_consistent:
    'Approval details are inconsistent with the service status.',
};

/**
 * Pulls the constraint name out of a Prisma error. Unique violations expose it
 * under `meta.target`; CHECK violations, which Prisma does not model, arrive as
 * a raw database error with the name embedded in the message.
 */
function constraintNameOf(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const target = error.meta?.['target'];
  if (typeof target === 'string') return target;
  if (Array.isArray(target) && typeof target[0] === 'string') return target[0];

  const message =
    typeof error.meta?.['message'] === 'string' ? error.meta['message'] : error.message;
  return /constraint "([^"]+)"/.exec(message)?.[1];
}

/**
 * Returns an `AppError` when the failure is a recognised database constraint,
 * or `null` when it is genuinely unexpected and should surface as a 500.
 */
export function translatePrismaError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientValidationError) {
    // A malformed query is always our bug, never the caller's.
    return null;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  const constraint = constraintNameOf(error);
  const known = constraint ? CONSTRAINT_MESSAGES[constraint] : undefined;

  switch (error.code) {
    // Unique constraint violated.
    case 'P2002':
      return conflict(known ?? 'That value is already in use.');

    // Foreign key constraint violated - the referenced record does not exist,
    // or a Restrict rule blocked a delete because history still points at it.
    case 'P2003':
      return businessRuleViolation(
        'That record is still referenced by existing data and cannot be changed. ' +
          'Deactivate it instead (SRS 21.5).',
      );

    // A required relation would be broken.
    case 'P2014':
      return businessRuleViolation(
        'That change would break a required relationship between records.',
      );

    // An operation targeted a row that no longer exists. Under an optimistic
    // update this is the race in SRS 24.4, not a genuine 404, but the caller
    // cannot tell the two apart and 404 is the safer answer (SRS 24.3).
    case 'P2025':
      return notFound();

    // CHECK constraint violations arrive here because Prisma has no dedicated
    // code for them. If the constraint is one of ours, the rule was bypassed
    // upstream - report it as a business-rule failure rather than a 500 so the
    // user sees something actionable.
    case 'P2010':
    case 'P2011':
      return known ? businessRuleViolation(known) : null;

    default:
      return known ? businessRuleViolation(known) : null;
  }
}
