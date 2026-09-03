/**
 * Admin dashboard (SRS 16.1, 16.2).
 *
 * "The Admin Dashboard shall prioritize services awaiting review while
 * providing direct access to master-data management."
 *
 * So the page is ordered by urgency rather than by prettiness: four headline
 * numbers, then the approval queue, then the two summary charts. The charts sit
 * *below* the queue deliberately — they are context for a quiet moment, and the
 * queue is the reason an administrator opened the page.
 *
 * The charts read data SRS 16.2 already requires and add no new storage. They
 * are a dashboard summary over a fixed window, not the reporting module SRS 29
 * excludes: no custom ranges, no export, no drill-down.
 */
import { CheckCircle2, ClipboardCheck, Route as RouteIcon, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { AdminServiceList } from '@/components/admin/service-list';
import { ActivityChart } from '@/components/charts/activity-chart';
import { RouteBars } from '@/components/charts/route-bars';
import { StatTile } from '@/components/charts/stat-tile';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHero,
} from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { ACTIVITY_DAYS, getDashboardData } from '@/modules/services/service/dashboard';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

export const metadata = { title: UI.admin.panelTitle };

export default async function AdminDashboard() {
  const actor = await requireAdmin();

  const [data, pending, recentlyApproved] = await Promise.all([
    getDashboardData(actor),
    serviceRepository.listRecent(actor, [ServiceStatus.PENDING_APPROVAL], 25),
    serviceRepository.listRecent(actor, [ServiceStatus.APPROVED], 5),
  ]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={UI.common.appName}
        title={UI.admin.panelTitle}
        description={
          data.pendingCount === 0
            ? UI.admin.nothingPending
            : UI.admin.pendingSummary(data.pendingCount)
        }
        action={
          data.pendingCount > 0 ? (
            <Link
              href="/admin/services?status=PENDING_APPROVAL"
              className="text-brand-ink inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold shadow-lg transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
            >
              <ClipboardCheck aria-hidden className="size-4" />
              {UI.admin.approvalQueue}
            </Link>
          ) : null
        }
      />

      {/* Four headline numbers are stat tiles, not a grouped bar chart — there
          is nothing to compare between a count and a distance. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={ClipboardCheck}
          label={SERVICE_STATUS_LABELS.PENDING_APPROVAL}
          value={data.pendingCount}
          tone={data.pendingCount > 0 ? 'pending' : 'neutral'}
          hint={UI.admin.awaitingReview}
        />
        <StatTile
          index={1}
          icon={CheckCircle2}
          label={SERVICE_STATUS_LABELS.APPROVED}
          value={data.approvedCount}
          tone="approved"
          hint={UI.admin.allTime}
        />
        <StatTile
          index={2}
          icon={RouteIcon}
          label={FIELD_LABELS.serviceKm}
          value={data.window.serviceKm}
          unit="km"
          hint={UI.admin.lastDays(ACTIVITY_DAYS)}
        />
        <StatTile
          index={3}
          icon={TrendingUp}
          label={UI.admin.servicesTitle}
          value={data.window.services}
          hint={UI.admin.lastDays(ACTIVITY_DAYS)}
        />
      </div>

      {/* The queue: the reason the page exists. */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <ClipboardCheck aria-hidden className="text-pending size-4" />
            {UI.admin.approvalQueue}
          </h2>
          <Link
            href="/admin/services"
            className="text-primary text-xs font-medium hover:underline"
          >
            {UI.admin.viewAllServices}
          </Link>
        </div>

        <AdminServiceList
          services={pending.map(toServiceListItem)}
          empty={
            <EmptyState
              icon={CheckCircle2}
              title={UI.admin.allClear}
              description={UI.admin.allClearHint}
            />
          }
        />
      </section>

      {/* Context, below the work. */}
      <div className="grid gap-4 lg:grid-cols-2">
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

      {recentlyApproved.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">{UI.driver.recentlyApproved}</h2>
          <AdminServiceList services={recentlyApproved.map(toServiceListItem)} />
        </section>
      ) : null}
    </div>
  );
}
