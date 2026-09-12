/**
 * The analytics layer (ERP roadmap Phase 6, roadmap §3.4) — the replacement
 * for `00Dashboard` / `00Análisis` / `90_Modelo`.
 *
 * Admin-only, and entirely derived: no table, no migration, the same shape
 * as `taxService` (Phase 4). Each method fetches the projections it needs
 * from `analyticsRepository`, buckets them by fiscal period (and optionally
 * one vehicle) in application code, and applies the `domain/analytics-math`
 * formulas. See ADR 0017 for why the grouping is not SQL `GROUP BY`.
 *
 * Client decision 2026-09-13 dropped the separate per-vehicle/per-contract/
 * per-driver breakdown tables in favour of an optional `vehicleId` filter on
 * `overview` itself, and moved `investmentRecovery` off this page onto
 * `/admin/investments` (still computed here — it needs revenue/fuel/expense
 * aggregated the same way `overview` does — just no longer rendered here).
 *
 * "Revenue" throughout is `Σ service.baseCents` — the "Base imponible"
 * (rate + supplement) Phase 4 made a stored column — over services that have
 * a rate. A closed month's services are all approved, so restricting to
 * approved would not change a historical figure; a priced but still-pending
 * service is revenue in progress and is counted.
 *
 * "Fuel cost" throughout is `Σ refuelling.baseCents` — VAT-exclusive - never
 * `totalCents`, which is what was actually paid at the pump but is not itself
 * a business cost (client decision 2026-09-13). The one exception is the
 * average pump price, which is deliberately VAT-inclusive.
 *
 * "Personnel cost" is a fleet-level monthly total (`04_Personal`) and is
 * **not** attributed to individual vehicles — the sheet does not split it
 * either, so `overview` excludes it from both the figure and the margin
 * whenever `filter.vehicleId` narrows to one vehicle.
 */
import type { Actor } from '@/lib/auth/session';
import { forbidden } from '@/lib/errors/app-error';
import {
  averageFuelPriceCentsPerLiter,
  consumptionMlPer100Km,
  emptyKm,
  investmentRecovery,
  marginCents,
  safeRatio,
  type InvestmentRecovery,
} from '@/modules/analytics/domain/analytics-math';
import { kmSinceLast } from '@/modules/refuelling/domain/consumption';
import { Role } from '@/modules/services/domain/service-status';
import {
  analyticsRepository,
  type AnalyticsReceivedInvoiceRow,
  type AnalyticsRefuellingRow,
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
  filter: { year: number | null; month: number | null; vehicleId: string | null };
  revenueCents: number;
  /** "Base imponible" only - VAT excluded (client decision 2026-09-13). */
  fuelCents: number;
  /**
   * Fleet-wide only - never attributable to one vehicle (`04_Personal` has no
   * per-vehicle split). `0` whenever `filter.vehicleId` narrows to a single
   * vehicle, and left out of `marginCents` in that case too - the same
   * "can't attribute it, don't fake it" rule the old per-vehicle table
   * followed.
   */
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
  /** The pump price actually paid, VAT included - what a driver sees at the
   * pump, unlike `fuelCents` above. */
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

/**
 * Attaches each refuel's `kmSinceLast` - the odometer delta versus that same
 * vehicle's previous fill-up, matching the client's own "Litros repostaje /
 * Km recorridos" method (client decision 2026-09-13) - rather than the fleet-
 * wide period totals `consumptionMlPer100Km` used before, which mixed
 * `Refuelling.litersMl` against an unrelated `DailyKmLog` total.
 *
 * Computed over every refuel a vehicle has ever had, not just the filtered
 * period: a fill-up right after a period boundary still needs the previous
 * fill (which may fall just before it) to know its own distance.
 */
function attachKmSinceLast(
  refuellings: AnalyticsRefuellingRow[],
): (AnalyticsRefuellingRow & { kmSinceLast: number | null })[] {
  const byVehicle = new Map<string, AnalyticsRefuellingRow[]>();
  for (const row of refuellings) {
    const rows = byVehicle.get(row.vehicleId);
    if (rows) rows.push(row);
    else byVehicle.set(row.vehicleId, [row]);
  }

  const result: (AnalyticsRefuellingRow & { kmSinceLast: number | null })[] = [];
  for (const rows of byVehicle.values()) {
    rows.sort(
      (a, b) => a.refuelDate.getTime() - b.refuelDate.getTime() || a.odometerKm - b.odometerKm,
    );
    let previousOdometerKm: number | null = null;
    for (const row of rows) {
      result.push({ ...row, kmSinceLast: kmSinceLast(row.odometerKm, previousOdometerKm) });
      previousOdometerKm = row.odometerKm;
    }
  }
  return result;
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

    const vehicleId = filter.vehicleId;
    const matchesVehicle = (rowVehicleId: string | null) =>
      vehicleId === undefined || rowVehicleId === vehicleId;

    const s = services.filter(
      (row) => dateInFilter(row.serviceDate, filter) && matchesVehicle(row.vehicleId),
    );
    // Every refuel this vehicle has ever had, so `attachKmSinceLast` can find
    // the previous fill even when it falls outside the filtered period -
    // filtered to the period (and vehicle) only afterwards.
    const rWithKm = attachKmSinceLast(
      vehicleId === undefined ? refuellings : refuellings.filter((row) => row.vehicleId === vehicleId),
    ).filter((row) => dateInFilter(row.refuelDate, filter));
    const inv = received.filter(
      (row) => dateInFilter(row.invoiceDate, filter) && matchesVehicle(row.vehicleId),
    );
    // Personnel cost has no per-vehicle split (see the doc comment at the top
    // of this file) - it only means anything fleet-wide, so a vehicle filter
    // excludes it rather than showing a fleet-wide figure mislabelled as one
    // vehicle's cost (client decision 2026-09-13).
    const p = vehicleId === undefined ? personnel.filter((row) => inFilter(row.year, row.month, filter)) : [];
    const km = dailyKm.filter(
      (row) => dateInFilter(row.date, filter) && matchesVehicle(row.vehicleId),
    );

    const revenueCents = sum(s.map(baseOf));
    // "Base imponible" only - VAT is not a real cost (client decision
    // 2026-09-13). The average pump price below still uses the VAT-inclusive
    // total, since that is the price actually paid at the pump.
    const fuelCents = sum(rWithKm.map((row) => row.baseCents));
    const fuelGrossCents = sum(rWithKm.map((row) => row.totalCents));
    const personnelCents = sum(p.map((row) => row.totalCents));
    const operatingExpenseCents = sum(inv.map(operatingExpenseOf));
    const investmentCents = sum(
      inv.filter((row) => row.expenseType === INVESTMENT).map((row) => row.totalCents),
    );
    const costs = vehicleId === undefined ? [fuelCents, personnelCents, operatingExpenseCents] : [fuelCents, operatingExpenseCents];
    const margin = marginCents(revenueCents, costs);

    const actualKm = sum(km.map((row) => row.actualKm));
    const serviceKm = sum(s.map((row) => row.serviceKm));
    const litresMl = sum(rWithKm.map((row) => row.litersMl));
    // Km recorridos for the consumption ratio: the odometer distance each
    // refuel in the period actually covers, not `actualKm` above (a separate,
    // independently-entered `DailyKmLog` total the two used to be mismatched
    // against).
    const kmSinceLastTotal = sum(rWithKm.map((row) => row.kmSinceLast ?? 0));

    return {
      filter: { year: filter.year ?? null, month: filter.month ?? null, vehicleId: vehicleId ?? null },
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
      avgFuelPriceCentsPerLiter: averageFuelPriceCentsPerLiter(fuelGrossCents, litresMl),
      avgConsumptionMlPer100Km: consumptionMlPer100Km(litresMl, kmSinceLastTotal),
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
      // "Base imponible" only - VAT is not a real cost (client decision
      // 2026-09-13).
      row(year, month).fuelCents += refuel.baseCents;
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

  /**
   * "Recovery = accumulated vehicle profit vs. total investment" (roadmap §2,
   * `07_Inversiones`) — moved to the Inversiones page (client decision
   * 2026-09-13; the Análisis page no longer shows per-vehicle/contract/driver
   * breakdowns at all). All-time by design — a recovery figure for one month
   * is meaningless. Attributed profit is `revenue − fuel − operating expense`
   * for the vehicle, accumulated over every record.
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
        // "Base imponible" only - VAT is not a real cost (client decision
        // 2026-09-13), same fix as `overview`/`monthlyMargin`.
        const fuelCents = sum(vr.map((row) => row.baseCents));
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
