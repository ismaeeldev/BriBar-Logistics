/**
 * The analytics layer (ERP roadmap Phase 6, roadmap §3.4) — the replacement
 * for `00Dashboard` / `00Análisis` / `90_Modelo`.
 *
 * Admin-only, and entirely derived: no table, no migration, the same shape
 * as `taxService` (Phase 4) and `receivedInvoiceService.investmentSummary`
 * (Phase 3). Each method fetches the projections it needs from
 * `analyticsRepository`, buckets them by fiscal period / vehicle / contract /
 * driver in application code, and applies the `domain/analytics-math`
 * formulas. See ADR 0017 for why the grouping is not SQL `GROUP BY`.
 *
 * "Revenue" throughout is `Σ service.baseCents` — the "Base imponible"
 * (rate + supplement) Phase 4 made a stored column — over services that have
 * a rate. A closed month's services are all approved, so restricting to
 * approved would not change a historical figure; a priced but still-pending
 * service is revenue in progress and is counted.
 *
 * "Personnel cost" is a fleet-level monthly total (`04_Personal`) and is
 * **not** attributed to individual vehicles or contracts — the sheet does
 * not split it either. It appears in the fleet-wide margin only; per-vehicle
 * and per-contract margins are revenue minus the costs that *can* be
 * attributed.
 */
import type { Actor } from '@/lib/auth/session';
import { forbidden } from '@/lib/errors/app-error';
import {
  averageFuelPriceCentsPerLiter,
  averageTicketCents,
  consumptionMlPer100Km,
  costPerKmCents,
  efficiencyRatio,
  emptyKm,
  estimatedFuelCents,
  investmentRecovery,
  marginCents,
  safeRatio,
  type InvestmentRecovery,
} from '@/modules/analytics/domain/analytics-math';
import { configRepository } from '@/modules/config/repository/config.repository';
import { Role } from '@/modules/services/domain/service-status';
import {
  analyticsRepository,
  type AnalyticsReceivedInvoiceRow,
  type AnalyticsServiceRow,
} from '../repository/analytics.repository';
import type { AnalyticsFilter } from '../schemas/analytics.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

/**
 * UTC accessors on a `@db.Date` value — the discipline
 * `src/lib/time/time-of-day.ts` documents and `taxService` follows: the
 * server's offset must never shift which month a date lands in.
 */
function partsOf(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Whether a `year`/`month` pair falls inside the requested filter. */
function inFilter(year: number, month: number, filter: AnalyticsFilter): boolean {
  if (filter.year !== undefined && year !== filter.year) return false;
  if (filter.year !== undefined && filter.month !== undefined && month !== filter.month) {
    return false;
  }
  return true;
}

function dateInFilter(date: Date, filter: AnalyticsFilter): boolean {
  const { year, month } = partsOf(date);
  return inFilter(year, month, filter);
}

const OPERATION = 'OPERATION';
const INVESTMENT = 'INVESTMENT';

// --- DTOs -------------------------------------------------------------------

export interface AnalyticsOverview {
  filter: { year: number | null; month: number | null };
  revenueCents: number;
  fuelCents: number;
  personnelCents: number;
  operatingExpenseCents: number;
  investmentCents: number;
  marginCents: number;
  marginRatio: number | null;
  serviceCount: number;
  actualKm: number;
  serviceKm: number;
  emptyKm: number;
  litresMl: number;
  avgFuelPriceCentsPerLiter: number | null;
  avgConsumptionMlPer100Km: number | null;
}

export interface MonthlyMarginRow {
  year: number;
  month: number;
  revenueCents: number;
  fuelCents: number;
  personnelCents: number;
  operatingExpenseCents: number;
  marginCents: number;
}

export interface VehicleAnalyticsRow {
  vehicleId: string;
  plate: string;
  name: string | null;
  revenueCents: number;
  fuelCents: number;
  operatingExpenseCents: number;
  marginCents: number;
  actualKm: number;
  serviceKm: number;
  emptyKm: number;
  emptyKmRatio: number | null;
  litresMl: number;
  avgConsumptionMlPer100Km: number | null;
  fuelCostPerKmCents: number | null;
}

export interface ContractAnalyticsRow {
  routeId: string;
  code: string;
  name: string;
  clientName: string | null;
  serviceCount: number;
  revenueCents: number;
  serviceKm: number;
  revenuePerServiceKmCents: number | null;
  efficiencyRatio: number | null;
  estimatedFuelCents: number;
  marginCents: number;
}

export interface DriverAnalyticsRow {
  driverId: string;
  name: string;
  serviceCount: number;
  daysWorked: number;
  actualKm: number;
  serviceKm: number;
  revenueCents: number;
  revenuePerActualKmCents: number | null;
  averageTicketCents: number | null;
}

export interface VehicleRecoveryRow extends InvestmentRecovery {
  vehicleId: string;
  plate: string;
  name: string | null;
}

// --- helpers --------------------------------------------------------------

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** A service's billable base, or `0` when it has no rate. */
function baseOf(service: AnalyticsServiceRow): number {
  return service.baseCents ?? 0;
}

function operatingExpenseOf(invoice: AnalyticsReceivedInvoiceRow): number {
  return invoice.expenseType === OPERATION ? invoice.totalCents : 0;
}

// --- service -------------------------------------------------------------

export const analyticsService = {
  async overview(actor: Actor, filter: AnalyticsFilter): Promise<AnalyticsOverview> {
    assertAdmin(actor);

    const [services, refuellings, received, personnel, dailyKm] = await Promise.all([
      analyticsRepository.services(),
      analyticsRepository.refuellings(),
      analyticsRepository.receivedInvoices(),
      analyticsRepository.personnelCosts(),
      analyticsRepository.dailyKmLogs(),
    ]);

    const s = services.filter((row) => dateInFilter(row.serviceDate, filter));
    const r = refuellings.filter((row) => dateInFilter(row.refuelDate, filter));
    const inv = received.filter((row) => dateInFilter(row.invoiceDate, filter));
    const p = personnel.filter((row) => inFilter(row.year, row.month, filter));
    const km = dailyKm.filter((row) => dateInFilter(row.date, filter));

    const revenueCents = sum(s.map(baseOf));
    const fuelCents = sum(r.map((row) => row.totalCents));
    const personnelCents = sum(p.map((row) => row.totalCents));
    const operatingExpenseCents = sum(inv.map(operatingExpenseOf));
    const investmentCents = sum(
      inv.filter((row) => row.expenseType === INVESTMENT).map((row) => row.totalCents),
    );
    const margin = marginCents(revenueCents, [fuelCents, personnelCents, operatingExpenseCents]);

    const actualKm = sum(km.map((row) => row.actualKm));
    const serviceKm = sum(s.map((row) => row.serviceKm));
    const litresMl = sum(r.map((row) => row.litersMl));

    return {
      filter: { year: filter.year ?? null, month: filter.month ?? null },
      revenueCents,
      fuelCents,
      personnelCents,
      operatingExpenseCents,
      investmentCents,
      marginCents: margin,
      marginRatio: safeRatio(margin, revenueCents),
      serviceCount: s.length,
      actualKm,
      serviceKm,
      emptyKm: emptyKm(actualKm, serviceKm),
      litresMl,
      avgFuelPriceCentsPerLiter: averageFuelPriceCentsPerLiter(fuelCents, litresMl),
      avgConsumptionMlPer100Km: consumptionMlPer100Km(litresMl, actualKm),
    };
  },

  /**
   * Every month that has any financial activity, oldest first — the margin
   * trend `00Dashboard` charts. Not filtered: the point of the series is to
   * see the whole history at once.
   */
  async monthlyMargin(actor: Actor): Promise<MonthlyMarginRow[]> {
    assertAdmin(actor);

    const [services, refuellings, received, personnel] = await Promise.all([
      analyticsRepository.services(),
      analyticsRepository.refuellings(),
      analyticsRepository.receivedInvoices(),
      analyticsRepository.personnelCosts(),
    ]);

    const byMonth = new Map<string, MonthlyMarginRow>();
    const row = (year: number, month: number): MonthlyMarginRow => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      let existing = byMonth.get(key);
      if (!existing) {
        existing = {
          year,
          month,
          revenueCents: 0,
          fuelCents: 0,
          personnelCents: 0,
          operatingExpenseCents: 0,
          marginCents: 0,
        };
        byMonth.set(key, existing);
      }
      return existing;
    };

    for (const service of services) {
      const { year, month } = partsOf(service.serviceDate);
      row(year, month).revenueCents += baseOf(service);
    }
    for (const refuel of refuellings) {
      const { year, month } = partsOf(refuel.refuelDate);
      row(year, month).fuelCents += refuel.totalCents;
    }
    for (const invoice of received) {
      const { year, month } = partsOf(invoice.invoiceDate);
      row(year, month).operatingExpenseCents += operatingExpenseOf(invoice);
    }
    for (const cost of personnel) {
      row(cost.year, cost.month).personnelCents += cost.totalCents;
    }

    return Array.from(byMonth.values())
      .map((month) => ({
        ...month,
        marginCents: marginCents(month.revenueCents, [
          month.fuelCents,
          month.personnelCents,
          month.operatingExpenseCents,
        ]),
      }))
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  },

  async perVehicle(actor: Actor, filter: AnalyticsFilter): Promise<VehicleAnalyticsRow[]> {
    assertAdmin(actor);

    const [vehicles, services, refuellings, received, dailyKm] = await Promise.all([
      analyticsRepository.vehicles(),
      analyticsRepository.services(),
      analyticsRepository.refuellings(),
      analyticsRepository.receivedInvoices(),
      analyticsRepository.dailyKmLogs(),
    ]);

    const s = services.filter((row) => dateInFilter(row.serviceDate, filter));
    const r = refuellings.filter((row) => dateInFilter(row.refuelDate, filter));
    const inv = received.filter((row) => dateInFilter(row.invoiceDate, filter));
    const km = dailyKm.filter((row) => dateInFilter(row.date, filter));

    return vehicles
      .map((vehicle) => {
        const vs = s.filter((row) => row.vehicleId === vehicle.id);
        const vr = r.filter((row) => row.vehicleId === vehicle.id);
        const vi = inv.filter((row) => row.vehicleId === vehicle.id);
        const vkm = km.filter((row) => row.vehicleId === vehicle.id);

        const revenueCents = sum(vs.map(baseOf));
        const fuelCents = sum(vr.map((row) => row.totalCents));
        const operatingExpenseCents = sum(vi.map(operatingExpenseOf));
        const actualKm = sum(vkm.map((row) => row.actualKm));
        const serviceKm = sum(vs.map((row) => row.serviceKm));
        const litresMl = sum(vr.map((row) => row.litersMl));
        const empty = emptyKm(actualKm, serviceKm);

        return {
          vehicleId: vehicle.id,
          plate: vehicle.registrationPlate,
          name: vehicle.referenceName,
          revenueCents,
          fuelCents,
          operatingExpenseCents,
          marginCents: marginCents(revenueCents, [fuelCents, operatingExpenseCents]),
          actualKm,
          serviceKm,
          emptyKm: empty,
          emptyKmRatio: safeRatio(empty, actualKm),
          litresMl,
          avgConsumptionMlPer100Km: consumptionMlPer100Km(litresMl, actualKm),
          fuelCostPerKmCents: costPerKmCents(fuelCents, actualKm),
        };
      })
      .filter(
        (row) =>
          row.revenueCents > 0 || row.fuelCents > 0 || row.actualKm > 0 || row.serviceKm > 0,
      );
  },

  async perContract(actor: Actor, filter: AnalyticsFilter): Promise<ContractAnalyticsRow[]> {
    assertAdmin(actor);

    const [routes, services, dailyKm, config] = await Promise.all([
      analyticsRepository.routes(),
      analyticsRepository.services(),
      analyticsRepository.dailyKmLogs(),
      configRepository.get(),
    ]);

    const s = services.filter((row) => dateInFilter(row.serviceDate, filter));
    const km = dailyKm.filter((row) => dateInFilter(row.date, filter));

    return routes
      .map((route) => {
        const rs = s.filter((row) => row.routeId === route.id);
        const rkm = km.filter((row) => row.routeId === route.id);

        const revenueCents = sum(rs.map(baseOf));
        const serviceKm = sum(rs.map((row) => row.serviceKm));
        const actualKm = sum(rkm.map((row) => row.actualKm));
        const estimated = estimatedFuelCents(
          serviceKm,
          config.defaultConsumptionMlPer100Km,
          config.defaultFuelPriceCentsPerLiter,
        );

        return {
          routeId: route.id,
          code: route.code,
          name: route.name,
          clientName: route.clientName,
          serviceCount: rs.length,
          revenueCents,
          serviceKm,
          revenuePerServiceKmCents: costPerKmCents(revenueCents, serviceKm),
          efficiencyRatio: actualKm > 0 ? efficiencyRatio(serviceKm, actualKm) : null,
          estimatedFuelCents: estimated,
          marginCents: marginCents(revenueCents, [estimated]),
        };
      })
      .filter((row) => row.serviceCount > 0 || row.revenueCents > 0);
  },

  async perDriver(actor: Actor, filter: AnalyticsFilter): Promise<DriverAnalyticsRow[]> {
    assertAdmin(actor);

    const [drivers, services, dailyKm] = await Promise.all([
      analyticsRepository.drivers(),
      analyticsRepository.services(),
      analyticsRepository.dailyKmLogs(),
    ]);

    const s = services.filter((row) => dateInFilter(row.serviceDate, filter));
    const km = dailyKm.filter((row) => dateInFilter(row.date, filter));

    return drivers
      .map((driver) => {
        const ds = s.filter((row) => row.driverId === driver.id);
        const dkm = km.filter((row) => row.driverId === driver.id);

        const serviceKm = sum(ds.map((row) => row.serviceKm));
        const actualKm = sum(dkm.map((row) => row.actualKm));
        const revenueCents = sum(ds.map(baseOf));
        // Days worked: distinct daily-km dates if logged, else distinct
        // service dates — the sheet's "días trabajados" from whichever record
        // the fleet actually keeps.
        const daysFromKm = new Set(dkm.map((row) => row.date.getTime())).size;
        const daysFromServices = new Set(ds.map((row) => row.serviceDate.getTime())).size;
        const daysWorked = daysFromKm > 0 ? daysFromKm : daysFromServices;
        const perKmBasis = actualKm > 0 ? actualKm : serviceKm;

        return {
          driverId: driver.id,
          name: driver.name,
          serviceCount: ds.length,
          daysWorked,
          actualKm,
          serviceKm,
          revenueCents,
          revenuePerActualKmCents: costPerKmCents(revenueCents, perKmBasis),
          averageTicketCents: averageTicketCents(revenueCents, ds.length),
        };
      })
      .filter((row) => row.serviceCount > 0 || row.actualKm > 0);
  },

  /**
   * "Recovery = accumulated vehicle profit vs. total investment"
   * (roadmap §2, `07_Inversiones`). All-time by design — a recovery figure
   * for one month is meaningless. Attributed profit is
   * `revenue − fuel − operating expense` for the vehicle, the same basis as
   * `perVehicle`'s margin, accumulated over every record.
   */
  async investmentRecovery(actor: Actor): Promise<VehicleRecoveryRow[]> {
    assertAdmin(actor);

    const [vehicles, services, refuellings, received] = await Promise.all([
      analyticsRepository.vehicles(),
      analyticsRepository.services(),
      analyticsRepository.refuellings(),
      analyticsRepository.receivedInvoices(),
    ]);

    return vehicles
      .map((vehicle) => {
        const vs = services.filter((row) => row.vehicleId === vehicle.id);
        const vr = refuellings.filter((row) => row.vehicleId === vehicle.id);
        const vi = received.filter((row) => row.vehicleId === vehicle.id);

        const revenueCents = sum(vs.map(baseOf));
        const fuelCents = sum(vr.map((row) => row.totalCents));
        const operatingExpenseCents = sum(vi.map(operatingExpenseOf));
        const investmentCents = sum(
          vi.filter((row) => row.expenseType === INVESTMENT).map((row) => row.totalCents),
        );
        const profit = marginCents(revenueCents, [fuelCents, operatingExpenseCents]);

        return {
          vehicleId: vehicle.id,
          plate: vehicle.registrationPlate,
          name: vehicle.referenceName,
          ...investmentRecovery(investmentCents, profit),
        };
      })
      .filter((row) => row.investmentCents > 0)
      .sort((a, b) => (a.recoveryRatio ?? 0) - (b.recoveryRatio ?? 0));
  },
} as const;
