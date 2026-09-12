/**
 * The shapes the API returns for a service (SRS 15.3, 16.4, 18.1).
 *
 * A presenter layer exists for two reasons that both bite without it.
 *
 * **Prisma rows are not JSON.** `departureTime` is a `Date` pinned to
 * 1970-01-01, `serviceDate` is a `Date` that means a calendar day, and
 * `JSON.stringify` renders both as full ISO timestamps — so a client would
 * receive `"1970-01-01T07:45:00.000Z"` for "07:45" and have to know why. The
 * conversion belongs here, once, next to the mapper that produced it.
 *
 * **The wire format is a contract.** Returning a Prisma row directly means any
 * column added later is published to every client automatically, including
 * columns that should not be. Naming the fields makes that a decision.
 */
import { dateToTimeOfDay } from '@/lib/time/time-of-day';
import { toIsoDate } from '@/lib/time/business-date';
import type { ServiceWithRelations } from '../repository/service.repository';
import type { ServiceStatus } from '../domain/service-status';

/** A row in a driver's history or the admin services table (SRS 15.3, 16.3). */
export interface ServiceListItem {
  id: string;
  serviceCode: string;
  /** `yyyy-MM-dd`. A calendar day, not an instant. */
  serviceDate: string;
  driver: { id: string; name: string };
  /** "Conductor adicional" - a second driver riding along, if any. */
  secondaryDriver: { id: string; name: string } | null;
  vehicle: { id: string; registrationPlate: string; referenceName: string | null };
  route: { id: string; code: string; name: string };
  origin: string;
  destination: string;
  actualKm: number;
  serviceKm: number;
  status: ServiceStatus;
}

/** Everything the detail page shows (SRS 16.4, Appendix A). */
export interface ServiceDetail extends ServiceListItem {
  startDashboardKm: number;
  startBaseKm: number;
  endBaseKm: number;
  endDashboardKm: number;
  /** `HH:MM`, exactly as the driver entered it. */
  departureTime: string;
  arrivalTime: string;
  endsNextDay: boolean;
  sites: string | null;
  observations: string | null;
  /** ISO instants, rendered in APP_TIMEZONE by the presentation layer. */
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  /** Whether the vehicle or route has since been deactivated (SRS 13.4). */
  vehicleIsActive: boolean;
  routeIsActive: boolean;
}

export function toServiceListItem(service: ServiceWithRelations): ServiceListItem {
  return {
    id: service.id,
    serviceCode: service.serviceCode,
    serviceDate: toIsoDate(service.serviceDate),
    driver: { id: service.driver.id, name: service.driver.name },
    secondaryDriver: service.secondaryDriver
      ? { id: service.secondaryDriver.id, name: service.secondaryDriver.name }
      : null,
    vehicle: {
      id: service.vehicle.id,
      registrationPlate: service.vehicle.registrationPlate,
      referenceName: service.vehicle.referenceName,
    },
    route: { id: service.route.id, code: service.route.code, name: service.route.name },
    // The snapshot, never the route's current values (SRS 14.5, 21.4).
    origin: service.originSnapshot,
    destination: service.destinationSnapshot,
    actualKm: service.actualKm,
    serviceKm: service.serviceKm,
    status: service.status,
  };
}

/**
 * The detail view with the rate attached (client change request 2026-09-09,
 * ERP roadmap Phase 0).
 *
 * A separate interface and mapper, not an optional field on `ServiceDetail` —
 * the driver's own service pages (`src/app/(app)/services/[id]/page.tsx`) call
 * `toServiceDetail`, and this presenter layer is the only thing standing
 * between the database row (which carries `rateCents` regardless of who is
 * asking — `SERVICE_INCLUDE` selects every scalar column) and the wire. Only
 * `/admin/services/[id]` and its edit page use this one.
 */
export interface AdminServiceDetail extends ServiceDetail {
  /** EUR cents, or null if no rate is assigned. Never sent to a driver. */
  rateCents: number | null;
  /** EUR cents, or null if no supplement is assigned (ERP roadmap Phase 4). */
  supplementCents: number | null;
  supplementTypeId: string | null;
  /** `rateCents + supplementCents` - "Base imponible". Null iff `rateCents` is. */
  baseCents: number | null;
  /** Which issued invoice this service's base was billed on, if any. */
  issuedInvoiceId: string | null;
}

export function toAdminServiceDetail(service: ServiceWithRelations): AdminServiceDetail {
  return {
    ...toServiceDetail(service),
    rateCents: service.rateCents,
    supplementCents: service.supplementCents,
    supplementTypeId: service.supplementTypeId,
    baseCents: service.baseCents,
    issuedInvoiceId: service.issuedInvoiceId,
  };
}

export function toServiceDetail(service: ServiceWithRelations): ServiceDetail {
  return {
    ...toServiceListItem(service),
    startDashboardKm: service.startDashboardKm,
    startBaseKm: service.startBaseKm,
    endBaseKm: service.endBaseKm,
    endDashboardKm: service.endDashboardKm,
    departureTime: dateToTimeOfDay(service.departureTime),
    arrivalTime: dateToTimeOfDay(service.arrivalTime),
    endsNextDay: service.endsNextDay,
    sites: service.sites,
    observations: service.observations,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    approvedAt: service.approvedAt?.toISOString() ?? null,
    approvedBy: service.approvedBy
      ? { id: service.approvedBy.id, name: service.approvedBy.name }
      : null,
    // SRS 13.4: a deactivated vehicle stays attached to its historical
    // services and "shall not be silently removed from historical displays" —
    // so the flag travels with the record and the UI can mark it.
    vehicleIsActive: service.vehicle.isActive,
    routeIsActive: service.route.isActive,
  };
}

/**
 * The Add Service context, as a client component receives it.
 *
 * `ServiceContext.serviceDate` is a `Date`. Passing it straight to a client
 * component looks harmless — Next.js does serialise Dates — but it made the
 * form crash on hydration with `RangeError: Invalid time value`: the server
 * render formatted a real Date, and the client received something the
 * formatter rejected, so `<ServiceForm>` never mounted. The form still
 * submitted, because a server action posts a plain HTML form, which is exactly
 * what made it hard to spot: everything worked except the live preview and the
 * route-change refresh.
 *
 * Converting at the boundary removes the ambiguity. A client component gets
 * strings and numbers; only the server handles `Date`.
 */
export interface ServiceContextDto {
  driver: { id: string; name: string };
  /** `yyyy-MM-dd`. */
  serviceDate: string;
  defaultVehicleId: string | null;
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  routes: {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
    isDefault: boolean;
  }[];
  defaultRouteId: string | null;
  hasAssignedRoutes: boolean;
  coDrivers: { id: string; name: string }[];
}

export function toServiceContextDto(context: {
  driver: { id: string; name: string };
  serviceDate: Date;
  defaultVehicleId: string | null;
  vehicles: { id: string; registrationPlate: string; referenceName: string | null }[];
  routes: ServiceContextDto['routes'];
  defaultRouteId: string | null;
  hasAssignedRoutes: boolean;
  coDrivers: { id: string; name: string }[];
}): ServiceContextDto {
  return { ...context, serviceDate: toIsoDate(context.serviceDate) };
}
