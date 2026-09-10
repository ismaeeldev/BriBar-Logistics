/**
 * The formulas behind `00Dashboard` / `00Análisis` (ERP roadmap Phase 6,
 * roadmap §3.4), as pure functions.
 *
 * The client's analysis sheets are ~55 `SUMIFS`/`XLOOKUP` cells over the
 * transaction tables. The *aggregation* (which rows belong to which month /
 * vehicle / contract) is `analyticsService`'s job; this file is only the
 * arithmetic each aggregate then applies — `€/km`, `L/100km`, "empty km",
 * operating margin, investment recovery — factored out so it is unit-tested
 * on its own and written exactly once.
 *
 * Every amount is integer EUR cents and every distance is whole kilometres,
 * the project's standing no-floats rule (`src/lib/money/money.ts`,
 * `src/modules/services/domain/mileage.ts`). Millilitres for fuel volume
 * (`src/lib/units/fuel.ts`). A ratio is the one place a plain `number`
 * (0–1-ish) is returned rather than a scaled integer — a percentage is a
 * display concern, formatted by the page.
 *
 * No imports (CLAUDE.md, `docs/architecture.md`).
 */

/**
 * `a / b`, or `null` when `b` is zero or negative.
 *
 * Every per-km / per-litre / per-service figure here divides by a quantity
 * that can legitimately be zero (a vehicle with no service km yet, a month
 * with no refuels). `null` — "not enough data to say" — is a truthful
 * answer; `0`, `NaN` or `Infinity` are not, and each breaks a different
 * consumer downstream.
 */
export function safeRatio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/**
 * Operating margin: revenue minus every cost that eats into it
 * (`facturación − combustible − coste personal − gastos de explotación`,
 * roadmap §3.4). Costs are passed already-summed; a negative result is a
 * real loss, not an error, and is returned as-is.
 */
export function marginCents(revenueCents: number, costCents: number[]): number {
  return costCents.reduce((net, cost) => net - cost, revenueCents);
}

/**
 * "Km vacío" — kilometres driven that were not billable service distance
 * (`km reales − km servicio`, roadmap §3.4). Clamped at zero: a daily-km
 * log and the services for the same day are entered independently and can
 * momentarily disagree, and "negative empty distance" is meaningless.
 */
export function emptyKm(actualKm: number, serviceKm: number): number {
  return Math.max(0, actualKm - serviceKm);
}

/**
 * A cost spread over a distance, in whole cents per km
 * (`coste comb./km`, roadmap §3.4). `null` when there is no distance to
 * spread it over.
 */
export function costPerKmCents(costCents: number, km: number): number | null {
  const ratio = safeRatio(costCents, km);
  return ratio === null ? null : Math.round(ratio);
}

/**
 * Average pump price, in whole cents per litre (`Precio/L = Total/Litros`,
 * `02Repostajes`). `litresMl` is millilitres; the division converts.
 */
export function averageFuelPriceCentsPerLiter(
  totalCents: number,
  litresMl: number,
): number | null {
  const ratio = safeRatio(totalCents, litresMl / 1_000);
  return ratio === null ? null : Math.round(ratio);
}

/**
 * Average consumption in millilitres per 100 km (`Consumo L/100km`,
 * `02Repostajes`), kept in millilitres so it stays an integer and matches
 * `AppConfig.defaultConsumptionMlPer100Km` / `formatLiters`'s unit.
 */
export function consumptionMlPer100Km(litresMl: number, km: number): number | null {
  const ratio = safeRatio(litresMl, km);
  return ratio === null ? null : Math.round(ratio * 100);
}

/**
 * The revenue a set of services represents, per service, in whole cents
 * (`04_Personal`'s "ticket medio"). `null` for an empty set.
 */
export function averageTicketCents(revenueCents: number, serviceCount: number): number | null {
  const ratio = safeRatio(revenueCents, serviceCount);
  return ratio === null ? null : Math.round(ratio);
}

/**
 * "Eficiencia" (`00Análisis`): the share of driven distance that was
 * billable service distance, `km servicio / km reales`. A ratio, so `0.87`
 * not `87`.
 */
export function efficiencyRatio(serviceKm: number, actualKm: number): number | null {
  return safeRatio(serviceKm, actualKm);
}

/**
 * Estimated fuel cost for a distance at the fleet's standard rates
 * (`00Análisis`'s "coste combustible estimado"), in whole cents — what fuel
 * *should* have cost for `km` at `AppConfig`'s default consumption and
 * price, to compare against what a contract's refuels actually cost.
 *
 * `consumptionMlPer100Km` and `fuelPriceCentsPerLiter` are `AppConfig`'s own
 * column units. Litres burned = `km / 100 × consumption`; cost = litres ×
 * price. One rounding point at the end, like `applyVat`.
 */
export function estimatedFuelCents(
  km: number,
  consumptionMlPer100Km: number,
  fuelPriceCentsPerLiter: number,
): number {
  const litres = (km / 100) * (consumptionMlPer100Km / 1_000);
  return Math.round(litres * fuelPriceCentsPerLiter);
}

/** One vehicle's position against what has been sunk into it (`07_Inversiones`). */
export interface InvestmentRecovery {
  /** `Σ` received-invoice totals categorised as investment for this vehicle. */
  investmentCents: number;
  /** Operating profit attributed to this vehicle since the records begin. */
  cumulativeProfitCents: number;
  /** `cumulativeProfitCents / investmentCents`, or `null` with nothing invested. */
  recoveryRatio: number | null;
  /** Still owed to break even; `0` once profit has caught up. */
  outstandingCents: number;
  recovered: boolean;
}

/**
 * "Recovery = accumulated vehicle profit vs. total investment"
 * (roadmap §2, `07_Inversiones`). ADR 0014 deferred this to Phase 6 because
 * it needs every cost source aggregated, which only exists now.
 */
export function investmentRecovery(
  investmentCents: number,
  cumulativeProfitCents: number,
): InvestmentRecovery {
  return {
    investmentCents,
    cumulativeProfitCents,
    recoveryRatio: safeRatio(cumulativeProfitCents, investmentCents),
    outstandingCents: Math.max(0, investmentCents - cumulativeProfitCents),
    recovered: cumulativeProfitCents >= investmentCents && investmentCents > 0,
  };
}
