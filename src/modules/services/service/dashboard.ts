import type { Actor } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { businessDateFor, toIsoDate } from '@/lib/time/business-date';
import { ServiceStatus } from '../domain/service-status';
import { serviceRepository } from '../repository/service.repository';

/**
 * The numbers behind the dashboards.
 *
 * Kept out of the pages so both dashboards read the same way, and out of
 * `service.service.ts` because none of it is a business rule — it is a set of
 * summary reads, each already scoped by the repository to what the actor may
 * see (SRS 9.7).
 *
 * Deliberately summary-level: fixed windows, no custom ranges, no export.
 * SRS 29 excludes an advanced reporting module, and this is the dashboard
 * SRS 15.2 and 16.2 ask for, not the beginnings of one.
 */

export const ACTIVITY_DAYS = 14;

/** The comparison window for the headline figures. */
export const TREND_DAYS = 7;

/**
 * How old a pending service has to be before it is an exception.
 *
 * Three days rather than one: a sheet filed this morning is not late, and a
 * panel that shouts about every service the day it arrives is one an
 * administrator learns to ignore.
 */
export const STALE_AFTER_DAYS = 3;

/**
 * How far above its route's own history a service has to run to be flagged.
 *
 * A quarter again on the day's driving is well outside ordinary variation —
 * traffic and a detour do not add 25% — and it is the number worth a second
 * look before the mileage is approved.
 */
export const UNUSUAL_DISTANCE_RATIO = 1.25;

/** Below this many past services a route has no baseline worth comparing to. */
const MIN_BASELINE_SAMPLE = 3;

export interface DashboardData {
  pendingCount: number;
  approvedCount: number;
  /** Today, split by status, so the three figures always agree. */
  today: { total: number; pending: number; approved: number };
  /** Yesterday's total, for the comparison under today's figure. */
  yesterdayTotal: number;
  /** The last `TREND_DAYS`, and the `TREND_DAYS` before that. */
  trend: { services: number; serviceKm: number; previousServiceKm: number };
  window: { services: number; actualKm: number; serviceKm: number };
  activity: { date: string; label: string; services: number; actualKm: number }[];
  routes: {
    routeId: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
    services: number;
    serviceKm: number;
  }[];
  exceptions: DashboardException[];
}

/**
 * Something an administrator should look at before anything else.
 *
 * The whole point of this list is that it is short and every entry is real —
 * an "attention" panel that is always full of the same three rows stops being
 * read within a week. So each kind below only appears when it actually
 * applies, and the panel renders nothing at all when the answer is "nothing".
 */
export type DashboardException =
  | { kind: 'pendingApproval'; count: number }
  | { kind: 'waitingTooLong'; oldestDate: string; days: number }
  | {
      kind: 'unusualDistance';
      serviceId: string;
      serviceCode: string;
      routeCode: string;
      actualKm: number;
      baselineKm: number;
    };

/** Midnight, `days` business days ago, in the configured timezone. */
function windowStart(days: number): Date {
  const today = businessDateFor(new Date(), env.APP_TIMEZONE);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/**
 * Every day in the window, whether or not it saw a service.
 *
 * A `GROUP BY` returns only days that have rows, and a trend drawn from that
 * silently compresses quiet days out of existence — five services on five
 * consecutive Mondays would look like five consecutive days of work.
 */
function fillDays(
  rows: { serviceDate: Date; services: number; actualKm: number }[],
  days: number,
): DashboardData['activity'] {
  const byDate = new Map(rows.map((row) => [toIsoDate(row.serviceDate), row]));
  const start = windowStart(days);

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const iso = toIsoDate(day);
    const row = byDate.get(iso);

    return {
      date: iso,
      // `dd/MM` — the year is the same across a two-week window.
      label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      services: row?.services ?? 0,
      actualKm: row?.actualKm ?? 0,
    };
  });
}

/** `days` business days before today, in the configured timezone. */
function daysAgo(days: number): Date {
  const day = businessDateFor(new Date(), env.APP_TIMEZONE);
  day.setUTCDate(day.getUTCDate() - days);
  return day;
}

/**
 * Pending services that are running noticeably long for their route.
 *
 * Two reads rather than one clever query: the pending set, then one grouped
 * average over the routes that set actually uses. Doing it in SQL would mean a
 * correlated subquery per row for a comparison that only ever looks at a
 * handful of services.
 *
 * Silent by design when there is nothing to say. A route with fewer than
 * `MIN_BASELINE_SAMPLE` past services has no baseline, and comparing against
 * one previous run would flag a route the second time it is ever driven.
 */
async function findUnusualDistances(
  actor: Actor,
  limit: number,
): Promise<DashboardException[]> {
  const pending = await serviceRepository.listRecent(
    actor,
    [ServiceStatus.PENDING_APPROVAL],
    50,
  );
  if (pending.length === 0) return [];

  const baselines = await serviceRepository.routeBaselines(actor, [
    ...new Set(pending.map((service) => service.routeId)),
  ]);

  return pending
    .flatMap((service) => {
      const baseline = baselines.get(service.routeId);
      if (!baseline || baseline.sample < MIN_BASELINE_SAMPLE) return [];
      if (baseline.averageActualKm <= 0) return [];
      if (service.actualKm <= baseline.averageActualKm * UNUSUAL_DISTANCE_RATIO) return [];

      return [
        {
          kind: 'unusualDistance' as const,
          serviceId: service.id,
          serviceCode: service.serviceCode,
          routeCode: service.route.code,
          actualKm: service.actualKm,
          baselineKm: baseline.averageActualKm,
        },
      ];
    })
    .sort((a, b) => b.actualKm / b.baselineKm - a.actualKm / a.baselineKm)
    .slice(0, limit);
}

export async function getDashboardData(
  actor: Actor,
  { days = ACTIVITY_DAYS, routeLimit = 5, withExceptions = false } = {},
): Promise<DashboardData> {
  const from = windowStart(days);
  const today = businessDateFor(new Date(), env.APP_TIMEZONE);
  const yesterday = daysAgo(1);
  const trendFrom = daysAgo(TREND_DAYS - 1);
  const previousTrendFrom = daysAgo(TREND_DAYS * 2 - 1);
  const staleBefore = daysAgo(STALE_AFTER_DAYS);

  const [
    pendingCount,
    approvedCount,
    todayCounts,
    yesterdayCounts,
    trendTotals,
    previousTrendTotals,
    window,
    activityRows,
    routes,
    stale,
    unusual,
  ] = await Promise.all([
    serviceRepository.countByStatus(actor, ServiceStatus.PENDING_APPROVAL),
    serviceRepository.countByStatus(actor, ServiceStatus.APPROVED),
    serviceRepository.countsByStatusOnDate(actor, today),
    serviceRepository.countsByStatusOnDate(actor, yesterday),
    serviceRepository.totals(actor, trendFrom),
    serviceRepository.totalsBetween(actor, previousTrendFrom, trendFrom),
    serviceRepository.totals(actor, from),
    serviceRepository.dailyActivity(actor, from),
    serviceRepository.routeTotals(actor, routeLimit, from),
    withExceptions
      ? serviceRepository.listStalePending(actor, staleBefore, 1)
      : Promise.resolve([]),
    withExceptions ? findUnusualDistances(actor, 2) : Promise.resolve([]),
  ]);

  const exceptions: DashboardException[] = [];

  if (pendingCount > 0) exceptions.push({ kind: 'pendingApproval', count: pendingCount });

  const oldest = stale[0];
  if (oldest) {
    const oldestIso = toIsoDate(oldest.serviceDate);
    exceptions.push({
      kind: 'waitingTooLong',
      // Only the oldest is fetched: a count of everything that is late would be
      // a second query for a number that says less than the date does.
      oldestDate: oldestIso,
      days: Math.round(
        (today.getTime() - oldest.serviceDate.getTime()) / (24 * 60 * 60 * 1000),
      ),
    });
  }

  exceptions.push(...unusual);

  return {
    pendingCount,
    approvedCount,
    today: todayCounts,
    yesterdayTotal: yesterdayCounts.total,
    trend: {
      services: trendTotals.services,
      serviceKm: trendTotals.serviceKm,
      previousServiceKm: previousTrendTotals.serviceKm,
    },
    window,
    activity: fillDays(activityRows, days),
    routes,
    exceptions,
  };
}
