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

export interface DashboardData {
  pendingCount: number;
  approvedCount: number;
  window: { services: number; actualKm: number; serviceKm: number };
  activity: { date: string; label: string; services: number; actualKm: number }[];
  routes: {
    routeId: string;
    code: string;
    name: string;
    services: number;
    serviceKm: number;
  }[];
}

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

export async function getDashboardData(
  actor: Actor,
  { days = ACTIVITY_DAYS, routeLimit = 5 } = {},
): Promise<DashboardData> {
  const from = windowStart(days);

  const [pendingCount, approvedCount, window, activityRows, routes] = await Promise.all([
    serviceRepository.countByStatus(actor, ServiceStatus.PENDING_APPROVAL),
    serviceRepository.countByStatus(actor, ServiceStatus.APPROVED),
    serviceRepository.totals(actor, from),
    serviceRepository.dailyActivity(actor, from),
    serviceRepository.routeTotals(actor, routeLimit, from),
  ]);

  return {
    pendingCount,
    approvedCount,
    window,
    activity: fillDays(activityRows, days),
    routes,
  };
}
