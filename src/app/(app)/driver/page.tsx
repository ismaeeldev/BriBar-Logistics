/**
 * Driver dashboard (SRS 15).
 *
 * SRS 15.1: "minimize navigation and make the Add Service workflow immediately
 * accessible." So the page is ordered by what a driver came here to do — the
 * Add Service action is the first thing on screen and the largest thing on it,
 * with the two lists below rather than competing for the top.
 */
import { ClipboardList, Plus, Map, Route as RouteIcon } from 'lucide-react';
import Link from 'next/link';

import { ActivityChart } from '@/components/charts/activity-chart';
import { MetricBlock } from '@/components/charts/metric-block';
import { ServiceCard } from '@/components/services/service-card';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHero,
} from '@/components/ui/primitives';
import { requireDriver } from '@/lib/auth/session';
import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { ACTIVITY_DAYS, getDashboardData } from '@/modules/services/service/dashboard';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

export const metadata = { title: UI.driver.myServices };

export default async function DriverDashboard() {
  const actor = await requireDriver();

  // The same summary the administrator sees, scoped by the repository to this
  // driver's own services (SRS 9.7) - a driver's dashboard shows their work,
  // not the fleet's.
  const [data, pending, recent] = await Promise.all([
    getDashboardData(actor, { routeLimit: 0 }),
    serviceRepository.listRecent(actor, [ServiceStatus.PENDING_APPROVAL], 20),
    serviceRepository.listRecent(actor, [ServiceStatus.APPROVED], 5),
  ]);

  return (
    <div className="space-y-6">
      {/*
        SRS 15.1 and 9.1: the primary action, "visually prominent and
        touch-friendly on mobile". It sits inside the band rather than under
        it — white on the brand gradient is the highest-contrast thing on the
        screen, which is what "unmissable" means here. Full width and 56px tall
        on a phone, so it is also hard to mis-tap.
      */}
      <PageHero
        title={UI.driver.greeting(actor.name.split(' ')[0] ?? actor.name)}
        description={UI.driver.panelSubtitle}
        action={
          <Link
            href="/services/new"
            className="text-brand-ink flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-white text-base font-semibold shadow-lg transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-13 sm:w-auto sm:px-8"
          >
            <Plus aria-hidden className="size-5" />
            {UI.driver.addService}
          </Link>
        }
      />

      {/* The driver's own fortnight, so the panel says something about their
          work rather than only listing it. */}
      <div className="grid grid-cols-3 gap-3">
        <MetricBlock
          index={0}
          label={UI.admin.servicesTitle}
          value={data.window.services}
          hint={UI.admin.lastDays(ACTIVITY_DAYS)}
          icon={<ClipboardList className="size-6" />}
          tone="neutral"
        />
        <MetricBlock
          index={1}
          label={FIELD_LABELS.serviceKm}
          value={data.window.serviceKm}
          unit="km"
          hint={UI.admin.lastDays(ACTIVITY_DAYS)}
          icon={<Map className="size-6" />}
          tone="purple"
        />
        <MetricBlock
          index={2}
          label={FIELD_LABELS.actualKm}
          value={data.window.actualKm}
          unit="km"
          hint={UI.admin.lastDays(ACTIVITY_DAYS)}
          icon={<RouteIcon className="size-6" />}
          tone="approved"
        />
      </div>

      {data.window.services > 0 ? (
        <Card className="lift">
          <CardHeader>
            <CardTitle>{UI.admin.activityTitle}</CardTitle>
            <p className="text-muted-foreground text-xs">{UI.admin.lastDays(ACTIVITY_DAYS)}</p>
          </CardHeader>
          <CardBody>
            <ActivityChart points={data.activity} />
          </CardBody>
        </Card>
      ) : null}

      {/* SRS 15.2: Pending Approval list. */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{SERVICE_STATUS_LABELS.PENDING_APPROVAL}</CardTitle>
          {pending.length > 0 ? (
            <span className="bg-pending-surface text-pending border-pending-border rounded-full border px-2 py-0.5 text-xs font-medium">
              {pending.length}
            </span>
          ) : null}
        </CardHeader>

        {pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={UI.driver.noPending}
            description={UI.driver.noPendingHint}
          />
        ) : (
          <div>
            {pending.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>

      {/* SRS 15.2: recent/Approved list, plus the link to the full history. */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{UI.driver.recentlyApproved}</CardTitle>
          <Link href="/services" className="text-primary text-xs font-medium hover:underline">
            {UI.driver.viewHistory}
          </Link>
        </CardHeader>

        {recent.length === 0 ? (
          <EmptyState title={UI.driver.noApproved} description={UI.driver.noApprovedHint} />
        ) : (
          <div>
            {recent.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
