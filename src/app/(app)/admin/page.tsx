/**
 * Admin dashboard (SRS 16.1, 16.2).
 *
 * "The Admin Dashboard shall prioritize services awaiting review while
 * providing direct access to master-data management."
 *
 * ## An operations overview, not a second services page
 *
 * This page used to open with the full approval queue — twenty-five rows,
 * most of the screen — which made it a duplicate of `/admin/services` with a
 * header on top. A dashboard that shows everything prioritises nothing.
 *
 * The order now answers an administrator's questions in the order they are
 * asked, and each section is sized by how often the answer is "act on this":
 *
 *   1. how much is happening, and is that more or less than usual
 *   2. **what needs me** — the exceptions, and nothing else
 *   3. what the fortnight looks like, and which contracts carry it
 *   4. a short tail of recent work, with a way through to all of it
 *
 * Step 2 is the one that makes this a fleet-operations screen rather than a
 * table with statistics above it. See `AttentionPanel`.
 *
 * Everything here reads data SRS 16.2 already requires and adds no new
 * storage. It is a dashboard summary over fixed windows, not the reporting
 * module SRS 29 excludes: no custom ranges, no export, no drill-down.
 */
import { Route as RouteIcon, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { AttentionPanel } from '@/components/admin/attention-panel';
import { AdminServiceList } from '@/components/admin/service-list';
import { ActivityChart } from '@/components/charts/activity-chart';
import { MetricBlock } from '@/components/charts/metric-block';
import { RouteBars } from '@/components/charts/route-bars';
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { LOCALE, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { currentBusinessDate, formatLongBusinessDate } from '@/lib/time/business-date';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { ACTIVITY_DAYS, getDashboardData } from '@/modules/services/service/dashboard';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

export const metadata = { title: UI.admin.panelTitle };

/**
 * How many services the dashboard shows before handing over to the full list.
 *
 * Five is enough to see what is waiting and not enough to be mistaken for the
 * queue itself — which is the whole point of the "view all" link beside it.
 */
const QUEUE_PREVIEW = 5;

export default async function AdminDashboard() {
  const actor = await requireAdmin();

  const [data, recent] = await Promise.all([
    getDashboardData(actor, { withExceptions: true }),
    serviceRepository.listRecent(actor, undefined, QUEUE_PREVIEW),
  ]);

  return (
    <div className="space-y-5">
      {/*
        A heading, not a banner. The gradient band that used to sit here was
        the loudest thing on an operations screen and said the least; the date
        is the one piece of context worth carrying, because every figure below
        is relative to it.
      */}
      <header className="animate-rise space-y-0.5">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {UI.admin.operationsOverview}
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {UI.driver.greeting(actor.name.split(' ')[0] ?? actor.name)}
        </h1>
        <p className="text-muted-foreground text-sm">
          {formatLongBusinessDate(currentBusinessDate(env.APP_TIMEZONE), LOCALE)}
        </p>
      </header>

      {/*
        Four figures, each with the comparison that makes it mean something.
        Today against yesterday for volume; the week against the week before
        for distance.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBlock
          index={0}
          label={UI.admin.servicesToday}
          value={data.today.total}
          previous={data.yesterdayTotal}
          comparison={UI.common.vsYesterday}
        />
        <MetricBlock
          index={1}
          label={SERVICE_STATUS_LABELS.PENDING_APPROVAL}
          value={data.pendingCount}
          tone={data.pendingCount > 0 ? 'pending' : 'neutral'}
          hint={UI.admin.awaitingReview}
        />
        <MetricBlock
          index={2}
          label={UI.admin.approvedToday}
          value={data.today.approved}
          tone="approved"
          hint={UI.admin.ofTodaysServices(data.today.total)}
        />
        <MetricBlock
          index={3}
          label={UI.admin.distanceThisWeek}
          value={data.trend.serviceKm}
          unit="km"
          previous={data.trend.previousServiceKm}
          comparison={UI.common.vsPreviousWeek}
        />
      </div>

      {/* The reason the page exists, when there is one. */}
      <AttentionPanel exceptions={data.exceptions} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp aria-hidden className="text-muted-foreground size-4" />
              {UI.admin.activityTitle}
            </CardTitle>
            <p className="text-muted-foreground text-xs">{UI.admin.lastDays(ACTIVITY_DAYS)}</p>
          </CardHeader>
          <CardBody>
            <ActivityChart points={data.activity} />
          </CardBody>
        </Card>

        <Card className="lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon aria-hidden className="text-muted-foreground size-4" />
              {UI.admin.topRoutesTitle}
            </CardTitle>
            <p className="text-muted-foreground text-xs">{UI.admin.lastDays(ACTIVITY_DAYS)}</p>
          </CardHeader>
          <CardBody>
            {data.routes.length === 0 ? (
              <EmptyState title={UI.admin.noRouteActivity} />
            ) : (
              <RouteBars routes={data.routes} />
            )}
          </CardBody>
        </Card>
      </div>

      {/*
        A tail, not the queue. Five of the most recent services whatever their
        status, so the page ends by showing that work is flowing rather than by
        repeating the approval list a third time.
      */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">{UI.admin.recentServices}</h2>
          <Link
            href="/admin/services"
            className="text-primary text-xs font-medium hover:underline"
          >
            {UI.admin.viewAllServices}
          </Link>
        </div>

        <AdminServiceList
          services={recent.map(toServiceListItem)}
          empty={<EmptyState title={UI.driver.noServices} />}
        />
      </section>
    </div>
  );
}
