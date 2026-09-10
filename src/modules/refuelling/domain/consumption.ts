/**
 * Odometer delta and fuel consumption, as a pure derivation (ERP roadmap
 * Phase 2, `02Repostajes`).
 *
 * The spreadsheet computes two figures per refuel row: `Km desde últ.
 * repostaje` (the odometer delta since the vehicle's previous fill-up) and
 * `Consumo L/100km` (litres pumped over that distance, scaled to a
 * per-100km rate — the standard European unit). Both need the *previous*
 * refuel for the same vehicle, which is a database query, so this file only
 * does the arithmetic; `refuelling.service.ts` is what finds the previous
 * row and calls in here.
 *
 * No imports (CLAUDE.md, `docs/architecture.md`): both functions take plain
 * numbers and return `null` for "not computable" rather than throwing, so a
 * vehicle's very first refuel — which has no previous row — renders as
 * "no previous data" instead of a crash.
 */

/**
 * Kilometres covered since the vehicle's previous refuel.
 *
 * `null` when there is no previous refuel (a vehicle's first one), or when
 * the previous reading is not strictly lower than this one — an odometer
 * cannot run backwards, so a non-positive delta means the two readings are
 * out of order (most likely a backdated entry inserted between two existing
 * ones) rather than a real distance, and reporting a negative or zero number
 * would be worse than admitting it cannot be computed.
 */
export function kmSinceLast(
  currentOdometerKm: number,
  previousOdometerKm: number | null,
): number | null {
  if (previousOdometerKm === null) return null;
  const delta = currentOdometerKm - previousOdometerKm;
  return delta > 0 ? delta : null;
}

/**
 * Litres per 100 km, in the same millilitre-scaled integer units as
 * `litersMl` — mirrors the spreadsheet's `Consumo L/100km` but keeps the
 * project's whole-number-only convention (`src/lib/units/fuel.ts`) rather
 * than introducing a float.
 *
 * `null` whenever `kmSinceLast` is `null` — there is nothing to divide by.
 */
export function consumptionMlPer100Km(litersMl: number, km: number | null): number | null {
  if (km === null || km <= 0) return null;
  return Math.round((litersMl * 100) / km);
}
