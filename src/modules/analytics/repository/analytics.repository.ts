/**
 * The reads behind the analytics layer (ERP roadmap Phase 6, roadmap §3.4).
 *
 * Every method here is a projection — the few columns one aggregate needs,
 * for every row, unscoped. `analyticsService` does the grouping in
 * application code with the Phase 1 `fiscalPeriodFromParts` helper and the
 * `domain/analytics-math` formulas, the same fetch-then-bucket shape ADR
 * 0015 chose for `taxService` and for the same reason: the quarter / month
 * rule stays written in one language, not duplicated into SQL.
 *
 * The row counts this runs over are a trucking company's own history — 140
 * services, 46 refuels, 90 invoices, ~14 personnel months (roadmap §2). A
 * `GROUP BY` would save nothing measurable and cost the ability to unit-test
 * the arithmetic.
 *
 * Admin-only at the service layer, so none of these reads carry the
 * visibility scoping the operational `serviceRepository` does.
 */
import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@/modules/services/domain/service-status';

export interface AnalyticsServiceRow {
  serviceDate: Date;
  vehicleId: string;
  driverId: string;
  routeId: string;
  actualKm: number;
  serviceKm: number;
  /** Null when the service has no rate yet, so no billable base. */
  baseCents: number | null;
  status: string;
}

export interface AnalyticsRefuellingRow {
  refuelDate: Date;
  vehicleId: string;
  driverId: string;
  litersMl: number;
  totalCents: number;
  baseCents: number;
}

export interface AnalyticsReceivedInvoiceRow {
  invoiceDate: Date;
  vehicleId: string | null;
  baseCents: number;
  totalCents: number;
  expenseType: string;
}

export interface AnalyticsPersonnelCostRow {
  year: number;
  month: number;
  totalCents: number;
}

export interface AnalyticsDailyKmRow {
  date: Date;
  vehicleId: string;
  routeId: string | null;
  driverId: string | null;
  actualKm: number;
  workedMinutes: number | null;
}

export interface AnalyticsVehicle {
  id: string;
  registrationPlate: string;
  referenceName: string | null;
}

export interface AnalyticsRoute {
  id: string;
  code: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
}

export interface AnalyticsDriver {
  id: string;
  name: string;
}

export const analyticsRepository = {
  async services(client: PrismaClientLike = prisma): Promise<AnalyticsServiceRow[]> {
    return client.service.findMany({
      select: {
        serviceDate: true,
        vehicleId: true,
        driverId: true,
        routeId: true,
        actualKm: true,
        serviceKm: true,
        baseCents: true,
        status: true,
      },
    });
  },

  async refuellings(client: PrismaClientLike = prisma): Promise<AnalyticsRefuellingRow[]> {
    return client.refuelling.findMany({
      select: {
        refuelDate: true,
        vehicleId: true,
        driverId: true,
        litersMl: true,
        totalCents: true,
        baseCents: true,
      },
    });
  },

  async receivedInvoices(
    client: PrismaClientLike = prisma,
  ): Promise<AnalyticsReceivedInvoiceRow[]> {
    const rows = await client.receivedInvoice.findMany({
      select: {
        invoiceDate: true,
        vehicleId: true,
        baseCents: true,
        totalCents: true,
        category: { select: { expenseType: true } },
      },
    });

    return rows.map((row) => ({
      invoiceDate: row.invoiceDate,
      vehicleId: row.vehicleId,
      baseCents: row.baseCents,
      totalCents: row.totalCents,
      expenseType: row.category.expenseType,
    }));
  },

  async personnelCosts(
    client: PrismaClientLike = prisma,
  ): Promise<AnalyticsPersonnelCostRow[]> {
    return client.personnelCost.findMany({
      select: { year: true, month: true, totalCents: true },
    });
  },

  async dailyKmLogs(client: PrismaClientLike = prisma): Promise<AnalyticsDailyKmRow[]> {
    return client.dailyKmLog.findMany({
      select: {
        date: true,
        vehicleId: true,
        routeId: true,
        driverId: true,
        actualKm: true,
        workedMinutes: true,
      },
    });
  },

  async vehicles(client: PrismaClientLike = prisma): Promise<AnalyticsVehicle[]> {
    return client.vehicle.findMany({
      select: { id: true, registrationPlate: true, referenceName: true },
      orderBy: [{ isActive: 'desc' }, { registrationPlate: 'asc' }],
    });
  },

  async routes(client: PrismaClientLike = prisma): Promise<AnalyticsRoute[]> {
    const rows = await client.route.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        clientId: true,
        client: { select: { name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      clientId: row.clientId,
      clientName: row.client?.name ?? null,
    }));
  },

  async drivers(client: PrismaClientLike = prisma): Promise<AnalyticsDriver[]> {
    return client.user.findMany({
      where: { role: Role.DRIVER },
      select: { id: true, name: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },
} as const;

export type AnalyticsRepository = typeof analyticsRepository;
