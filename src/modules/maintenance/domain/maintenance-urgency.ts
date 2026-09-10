/**
 * The URGENTE/PRÓXIMO/OK bands the roadmap asks `08_Mantenimiento`'s alerts
 * to use (ERP roadmap Phase 5), as a pure derivation.
 *
 * The specific thresholds below are a provisional default, not a client
 * answer — roadmap §6 D12 ("is the due-date engine complete as +15000km /
 * +6 months, or are there other maintenance types with their own
 * intervals?") is still open, and nothing in the sheet states how many
 * kilometres or days count as "urgent" versus merely "upcoming". Kept as
 * named, exported constants specifically so the day D12 is answered, this
 * file is the one place the bands change — not a search for a magic number
 * spread across the service layer and the UI.
 *
 * No imports (CLAUDE.md, `docs/architecture.md`).
 */

export type MaintenanceUrgency = 'URGENT' | 'UPCOMING' | 'OK' | 'UNKNOWN';

/** Within this many km of the next due reading (or already past it): urgent. */
export const URGENT_KM_THRESHOLD = 500;
/** Within this many km: upcoming. Anything further out: OK. */
export const UPCOMING_KM_THRESHOLD = 2_000;
/** Within this many days of the next due date (or already past it): urgent. */
export const URGENT_DAY_THRESHOLD = 14;
/** Within this many days: upcoming. Anything further out: OK. */
export const UPCOMING_DAY_THRESHOLD = 30;

const SEVERITY: Record<MaintenanceUrgency, number> = { UNKNOWN: 0, OK: 1, UPCOMING: 2, URGENT: 3 };

function kmUrgency(nextDueKm: number | null, currentKm: number | null): MaintenanceUrgency {
  if (nextDueKm === null || currentKm === null) return 'UNKNOWN';
  const remaining = nextDueKm - currentKm;
  if (remaining <= URGENT_KM_THRESHOLD) return 'URGENT';
  if (remaining <= UPCOMING_KM_THRESHOLD) return 'UPCOMING';
  return 'OK';
}

function dateUrgency(nextDueDate: Date | null, today: Date): MaintenanceUrgency {
  if (nextDueDate === null) return 'UNKNOWN';
  const remainingDays = Math.floor(
    (nextDueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (remainingDays <= URGENT_DAY_THRESHOLD) return 'URGENT';
  if (remainingDays <= UPCOMING_DAY_THRESHOLD) return 'UPCOMING';
  return 'OK';
}

/**
 * The overall band for one maintenance record: whichever of the km-based and
 * date-based signals is more urgent, since a maintenance type may be tracked
 * by either or both (an oil change is km-only; an ITV is date-only). `null`
 * inputs make a signal `'UNKNOWN'` rather than forcing a band, so a
 * date-only type is never judged on a kilometre count it was never given.
 * `'UNKNOWN'` only wins when *both* signals are unavailable — there is
 * nothing to say "OK" about otherwise.
 */
export function maintenanceUrgency(input: {
  nextDueKm: number | null;
  currentKm: number | null;
  nextDueDate: Date | null;
  today: Date;
}): MaintenanceUrgency {
  const km = kmUrgency(input.nextDueKm, input.currentKm);
  const date = dateUrgency(input.nextDueDate, input.today);
  return SEVERITY[km] >= SEVERITY[date] ? km : date;
}
