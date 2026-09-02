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
