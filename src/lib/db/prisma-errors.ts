/**
 * Translates Prisma's error codes into the application's error taxonomy.
 *
 * This lives in the data-access layer on purpose. It is the only module outside
 * repositories that needs to know Prisma exists, which keeps the HTTP wrapper
 * and the service layer free of ORM specifics (SRS 4.2, 30.1).
 *
 * Only constraint violations that represent a *race* are translated. A unique
 * violation the application should have prevented — submitting a duplicate
 * vehicle plate, say — is still worth reporting as a clean 409 rather than a
 * 500, because the pre-check and the insert are not atomic and a concurrent
 * request can always slip between them.
 */
import { Prisma } from '@prisma/client';

import {
  businessRuleViolation,
  conflict,
  notFound,
  type AppError,
} from '@/lib/errors/app-error';
import { CONSTRAINT_MESSAGES } from '@/lib/i18n/messages';

/** Constraint names from the migrations, mapped to their user-facing message. */
const MESSAGE_BY_CONSTRAINT: Record<string, string> = {
  users_login_identifier_key: CONSTRAINT_MESSAGES.loginIdentifierTaken,
  vehicles_registration_plate_key: CONSTRAINT_MESSAGES.plateTaken,
  routes_code_key: CONSTRAINT_MESSAGES.routeCodeTaken,
  services_service_code_key: CONSTRAINT_MESSAGES.serviceCodeTaken,
  driver_routes_driver_id_route_id_key: CONSTRAINT_MESSAGES.routeAlreadyAssigned,
  driver_routes_one_default_per_driver: CONSTRAINT_MESSAGES.onlyOneDefaultRoute,
  services_mileage_sequence: CONSTRAINT_MESSAGES.mileageSequence,
  services_mileage_non_negative: CONSTRAINT_MESSAGES.mileageNegative,
  services_actual_km_formula: CONSTRAINT_MESSAGES.actualKmFormula,
  services_service_km_formula: CONSTRAINT_MESSAGES.serviceKmFormula,
  services_service_km_within_actual: CONSTRAINT_MESSAGES.serviceKmWithinActual,
  services_approval_metadata_consistent: CONSTRAINT_MESSAGES.approvalMetadata,
  services_times_consistent: CONSTRAINT_MESSAGES.serviceTimes,
  routes_default_rate_non_negative: CONSTRAINT_MESSAGES.rateNonNegative,
  services_rate_non_negative: CONSTRAINT_MESSAGES.rateNonNegative,
  lookup_items_kind_name_key: CONSTRAINT_MESSAGES.lookupNameTaken,
  app_config_positive_defaults: CONSTRAINT_MESSAGES.configInvalidValue,
  refuellings_refuel_code_key: CONSTRAINT_MESSAGES.refuelCodeTaken,
  refuellings_odometer_non_negative: CONSTRAINT_MESSAGES.refuelOdometerNegative,
  refuellings_liters_positive: CONSTRAINT_MESSAGES.refuelLitersInvalid,
  refuellings_total_non_negative: CONSTRAINT_MESSAGES.refuelTotalNegative,
  refuellings_base_vat_sum: CONSTRAINT_MESSAGES.refuelBaseVatMismatch,
  received_invoices_invoice_code_key: CONSTRAINT_MESSAGES.invoiceCodeTaken,
  received_invoices_base_non_negative: CONSTRAINT_MESSAGES.invoiceBaseNegative,
  received_invoices_vat_sum: CONSTRAINT_MESSAGES.invoiceVatMismatch,
  issued_invoices_invoice_code_key: CONSTRAINT_MESSAGES.invoiceCodeTaken,
  issued_invoices_base_non_negative: CONSTRAINT_MESSAGES.invoiceBaseNegative,
  issued_invoices_vat_sum: CONSTRAINT_MESSAGES.invoiceVatMismatch,
  daily_km_logs_vehicle_id_date_key: CONSTRAINT_MESSAGES.dailyKmLogDateTaken,
  daily_km_logs_km_non_negative: CONSTRAINT_MESSAGES.mileageNegative,
  daily_km_logs_worked_minutes_non_negative: CONSTRAINT_MESSAGES.workedHoursNegative,
  personnel_costs_user_id_year_month_key: CONSTRAINT_MESSAGES.personnelCostMonthTaken,
  personnel_costs_amounts_non_negative: CONSTRAINT_MESSAGES.personnelCostAmountsNegative,
  personnel_costs_month_range: CONSTRAINT_MESSAGES.personnelCostMonthRange,
  personnel_costs_total_formula: CONSTRAINT_MESSAGES.personnelCostTotalMismatch,
  maintenance_records_maintenance_code_key: CONSTRAINT_MESSAGES.maintenanceCodeTaken,
  maintenance_records_km_non_negative: CONSTRAINT_MESSAGES.maintenanceKmNegative,
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
  const known = constraint ? MESSAGE_BY_CONSTRAINT[constraint] : undefined;

  switch (error.code) {
    // Unique constraint violated.
    case 'P2002':
      return conflict(known ?? CONSTRAINT_MESSAGES.valueInUse);

    // Foreign key constraint violated — the referenced record does not exist,
    // or a Restrict rule blocked a delete because history still points at it.
    case 'P2003':
      return businessRuleViolation(CONSTRAINT_MESSAGES.stillReferenced);

    // A required relation would be broken.
    case 'P2014':
      return businessRuleViolation(CONSTRAINT_MESSAGES.brokenRelation);

    // An operation targeted a row that no longer exists. Under an optimistic
    // update this is the race in SRS 24.4, not a genuine 404, but the caller
    // cannot tell the two apart and 404 is the safer answer (SRS 24.3).
    case 'P2025':
      return notFound();

    // CHECK constraint violations arrive here because Prisma has no dedicated
    // code for them. If the constraint is one of ours, the rule was bypassed
    // upstream — report it as a business-rule failure rather than a 500 so the
    // user sees something actionable.
    case 'P2010':
    case 'P2011':
      return known ? businessRuleViolation(known) : null;

    default:
      return known ? businessRuleViolation(known) : null;
  }
}
