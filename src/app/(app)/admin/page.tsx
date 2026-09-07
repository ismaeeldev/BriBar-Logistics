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
import { Route as RouteIcon, TrendingUp, CheckCircle2, ClipboardList, Clock, ChevronRight, Activity } from 'lucide-react';
import Link from 'next/link';

import { AttentionPanel } from '@/components/admin/attention-panel';
import { AdminServiceList } from '@/components/admin/service-list';
import { ActivityChart } from '@/components/charts/activity-chart';
import { MetricBlock } from '@/components/charts/metric-block';
import { RouteBars } from '@/components/charts/route-bars';
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { currentBusinessDate, toIsoDate } from '@/lib/time/business-date';
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
      {/* Top: 4 metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricBlock
          index={0}
          label={UI.admin.servicesToday}
          value={data.today.total}
          previous={data.yesterdayTotal}
          comparison={UI.common.vsYesterday}
          icon={<ClipboardList className="size-5" />}
          tone="neutral"
          className="bg-card rounded-2xl shadow-sm border border-border/40 p-5"
        />
        <MetricBlock
          index={1}
          label={UI.admin.approvedToday}
          value={data.today.approved}
          tone="approved"
          hint={UI.admin.ofTodaysServices(data.today.total)}
          icon={<CheckCircle2 className="size-5" />}
          className="bg-card rounded-2xl shadow-sm border border-border/40 p-5"
        />
        <MetricBlock
          index={2}
          label="In Progress"
          value={data.today.pending}
          tone="neutral"
          hint={`of today's ${data.today.total}`}
          icon={<Activity className="size-5" />}
          className="bg-card rounded-2xl shadow-sm border border-border/40 p-5"
        />
        <MetricBlock
          index={3}
          label={SERVICE_STATUS_LABELS.PENDING_APPROVAL}
          value={data.pendingCount}
          tone={data.pendingCount > 0 ? 'pending' : 'neutral'}
          hint={UI.admin.awaitingReview}
          icon={<Clock className="size-5" />}
          className="bg-card rounded-2xl shadow-sm border border-border/40 p-5"
        />
      </div>

      {/* Mid/Bottom Layout: Recent Services | Sidebar */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">

        {/* Recent Services - Main area */}
        <Card className="rounded-2xl shadow-sm border border-border/40 overflow-hidden">
          <CardHeader className="border-b border-border/40 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">{UI.admin.recentServices}</CardTitle>
              <Link
                href="/admin/services"
                className="text-primary text-[13px] font-medium hover:underline flex items-center gap-1"
              >
                {UI.admin.viewAllServices}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <div className="p-0">
            <AdminServiceList
              services={recent.map(toServiceListItem)}
              todayIso={toIsoDate(currentBusinessDate(env.APP_TIMEZONE))}
              empty={<EmptyState title={UI.driver.noServices} />}
              tableClassName="border-0 rounded-none shadow-none"
            />
          </div>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Pending Approval Card */}
          <Card className="rounded-2xl shadow-sm border border-border/40 overflow-hidden">
            <CardHeader className="border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-orange-100">
                  <Clock className="size-3 text-orange-500" />
                </span>
                <CardTitle className="text-sm font-semibold">{SERVICE_STATUS_LABELS.PENDING_APPROVAL}</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="px-5 py-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tabular-nums leading-none text-orange-500">{data.pendingCount}</p>
                  <p className="text-muted-foreground text-xs mt-1">{UI.admin.awaitingReview}</p>
                </div>
                <Link
                  href="/admin/services?status=PENDING_APPROVAL"
                  className="text-primary text-[12px] font-medium hover:underline flex items-center gap-0.5"
                >
                  Review
                  <ChevronRight className="size-3" />
                </Link>
              </div>
              {data.pendingCount > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, (data.pendingCount / Math.max(data.today.total, 1)) * 100)}%` }}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Today breakdown */}
          <Card className="rounded-2xl shadow-sm border border-border/40 overflow-hidden">
            <CardHeader className="border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                </span>
                <CardTitle className="text-sm font-semibold">{UI.admin.todayBreakdownTitle}</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="px-5 py-4">
              {(() => {
                const totalToday = data.today.total;
                const approvedToday = data.today.approved;
                const pendingToday = Math.max(0, totalToday - approvedToday);
                const approvedSharePct = totalToday > 0 ? Math.round((approvedToday / totalToday) * 100) : 0;
                return (
                  <div className="flex items-center gap-4">
                    {/* Mini donut */}
                    <div className="relative flex shrink-0 size-16 items-center justify-center">
                      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                        <path className="stroke-pending-surface" fill="none" strokeWidth="3.5"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="stroke-approved" fill="none" strokeWidth="3.5" strokeLinecap="round"
                          strokeDasharray={`${approvedSharePct}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div className="absolute text-center">
                        <p className="text-[15px] font-bold tabular-nums leading-none">{totalToday}</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-approved size-2 rounded-full" />
                          <span className="text-muted-foreground">{SERVICE_STATUS_LABELS.APPROVED}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{approvedToday}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-pending-surface border-pending-border size-2 rounded-full border" />
                          <span className="text-muted-foreground">Pending</span>
                        </div>
                        <span className="font-semibold tabular-nums">{pendingToday}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardBody>
          </Card>

          {/* Attention Panel */}
          {data.exceptions.length > 0 ? (
            <div className="bg-card rounded-2xl shadow-sm border border-border/40 overflow-hidden p-4">
              <AttentionPanel exceptions={data.exceptions} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom Layout: Activity Chart | Top Routes */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Activity Chart */}
        <Card className="rounded-2xl shadow-sm border border-border/40">
          <CardHeader className="border-b border-border/40 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp aria-hidden className="text-muted-foreground size-4" />
                  {UI.admin.activityTitle}
                </CardTitle>
                <p className="text-muted-foreground text-xs mt-0.5">{UI.admin.lastDays(ACTIVITY_DAYS)}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-2xl font-bold tabular-nums leading-none">{data.trend.services}</span>
                <span className="text-[10px] text-muted-foreground">services</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5 pt-3">
            <ActivityChart points={data.activity} />
            <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-bold tabular-nums leading-none">{data.window.services}</p>
                  <p className="text-[10px] text-muted-foreground">Total events</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100">
                  <TrendingUp className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[13px] font-bold tabular-nums leading-none">
                    {data.window.services > 0 ? (data.window.services / ACTIVITY_DAYS).toFixed(1) : '0'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Avg. per day</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Most Active Routes */}
        <Card className="rounded-2xl shadow-sm border border-border/40">
          <CardHeader className="border-b border-border/40 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <RouteIcon aria-hidden className="text-muted-foreground size-4" />
                  {UI.admin.topRoutesTitle}
                </CardTitle>
                <p className="text-muted-foreground text-xs mt-0.5">{UI.admin.lastDays(ACTIVITY_DAYS)}</p>
              </div>
              <Link href="/admin/routes" className="text-primary text-[13px] font-medium hover:underline flex items-center gap-0.5">
                View all
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5 pt-3">
            {data.routes.length === 0 ? (
              <EmptyState title={UI.admin.noRouteActivity} />
            ) : (
              <RouteBars routes={data.routes} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
