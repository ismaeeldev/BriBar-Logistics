/**
 * Admin service review (SRS 16.4, 17.3 `/admin/services/[id]`).
 *
 * "Required actions: Edit; Approve when Pending Approval. Approved behavior:
 * editing remains available to Admin."
 *
 * SRS 16.4 enumerates what the detail page must display: every automatic field,
 * every driver-entered field, calculated mileage, status, creation timestamp,
 * last-updated timestamp, and — once approved — the approval timestamp and the
 * approving administrator. All of it is here, plus the status history, which is
 * what makes SRS 21.3's audited post-approval edits legible.
 */
import { ArrowLeft, Pencil, Gauge, MapPin, Clock, FileText, ShieldCheck, Euro } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApproveButton } from '@/components/admin/approve-button';
import { ServiceRateEditor } from '@/components/admin/service-rate-editor';
import { JourneyBar } from '@/components/charts/journey-bar';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  ServiceStatusBadge,
} from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDate, formatBusinessDateTime } from '@/lib/time/business-date';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { toAdminServiceDetail } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: UI.admin.reviewTitle };

export default async function AdminServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; created?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let service;
  let history;
  try {
    service = toAdminServiceDetail(await serviceService.getById(actor, id));
    history = await serviceService.getStatusHistory(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const isPending = service.status === ServiceStatus.PENDING_APPROVAL;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/services"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.servicesTitle}
      </Link>

      {flags.created ? <Alert tone="success" title={UI.service.submitted} /> : null}
      {flags.updated ? <Alert tone="success" title={UI.service.saved} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
              #{service.serviceCode}
            </h1>
            <ServiceStatusBadge status={service.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {formatBusinessDate(service.serviceDate)} · {service.driver.name}
          </p>
        </div>

        {/* SRS 11.4: an administrator may edit in either state, including after
            approval. The button is therefore unconditional. */}
        <Link
          href={`/admin/services/${service.id}/edit`}
          className="border-input bg-card hover:bg-muted inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
        >
          <Pencil aria-hidden className="size-4" />
          {UI.common.edit}
        </Link>
      </div>

      {isPending ? <ApproveButton serviceId={service.id} /> : null}

      {/* One column on a phone, two from `xl`. The review facts stay in the
          reading column; the audit trail moves to a rail that stays in view
          while an administrator scrolls the numbers. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <Gauge className="size-5 text-blue-500" />
                {UI.service.mileageSection}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="bg-muted/30 border border-border/40 grid grid-cols-2 gap-3 rounded-xl p-5">
                <div>
                  <p className="text-muted-foreground text-[14px] mb-1">{FIELD_LABELS.actualKm}</p>
                  <p className="text-[26px] text-foreground tracking-tight">{service.actualKm}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[14px] mb-1">{FIELD_LABELS.serviceKm}</p>
                  <p className="text-[26px] text-foreground tracking-tight">{service.serviceKm}</p>
                </div>
              </div>

              {/* The four readings as the journey they describe: approach, the
              contracted leg, and the return. The ratio between them is the
              operationally interesting fact, and a list of four numbers hides
              it completely. */}
              <JourneyBar
                startDashboardKm={service.startDashboardKm}
                startBaseKm={service.startBaseKm}
                endBaseKm={service.endBaseKm}
                endDashboardKm={service.endDashboardKm}
              />

              <dl className="space-y-1">
                <DetailRow
                  label={FIELD_LABELS.startDashboardKm}
                  value={service.startDashboardKm}
                />
                <DetailRow label={FIELD_LABELS.startBaseKm} value={service.startBaseKm} />
                <DetailRow label={FIELD_LABELS.endBaseKm} value={service.endBaseKm} />
                <DetailRow
                  label={FIELD_LABELS.endDashboardKm}
                  value={service.endDashboardKm}
                />
              </dl>
            </CardBody>
          </Card>

          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <MapPin className="size-5 text-purple-500" />
                  {UI.service.routeSection}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="space-y-1">
                  <DetailRow
                    label={FIELD_LABELS.route}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span>
                          {service.route.code}
                          <span className="text-muted-foreground"> · {service.route.name}</span>
                        </span>
                        {!service.routeIsActive ? (
                          <span className="text-muted-foreground text-xs">
                            {UI.common.inactiveMarker}
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                  {/* SRS 14.5: what applied to *this* service, not what the route
                says today. Worth an administrator understanding, since they
                are the one who can change the route master. */}
                  <DetailRow label={FIELD_LABELS.origin} value={service.origin} />
                  <DetailRow label={FIELD_LABELS.destination} value={service.destination} />
                  <DetailRow
                    label={FIELD_LABELS.vehicle}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span>{service.vehicle.registrationPlate}</span>
                        {!service.vehicleIsActive ? (
                          <span className="text-muted-foreground text-xs">
                            {UI.common.deactivated}
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <Clock className="size-5 text-amber-500" />
                  {UI.service.timesSection}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="space-y-1">
                  <DetailRow
                    label={FIELD_LABELS.departureTime}
                    value={service.departureTime}
                  />
                  <DetailRow
                    label={FIELD_LABELS.arrivalTime}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span>{service.arrivalTime}</span>
                        {service.endsNextDay ? (
                          <span className="text-muted-foreground text-xs">
                            {UI.service.nextDay}
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                </dl>
              </CardBody>
            </Card>
          </div>

          {service.sites || service.observations ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <FileText className="size-5 text-emerald-500" />
                  {UI.service.driverNotesSection}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-5">
                {service.sites ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">{FIELD_LABELS.sites}</p>
                    <p className="text-sm whitespace-pre-wrap">{service.sites}</p>
                  </div>
                ) : null}
                {service.observations ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">{FIELD_LABELS.observations}</p>
                    <p className="text-sm whitespace-pre-wrap">{service.observations}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20">
          {/* Admin-only (client change request 2026-09-09): the driver never
              sees this card or anything in it. Placed before approval so the
              rate is reviewed — and correctable — in the same glance as the
              approve action. */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Euro className="size-5 text-green-600" />
                {UI.admin.rateSectionTitle}
              </CardTitle>
              <p className="text-muted-foreground text-xs">{UI.admin.rateHint}</p>
            </CardHeader>
            <CardBody>
              <ServiceRateEditor serviceId={service.id} rateCents={service.rateCents} />
            </CardBody>
          </Card>

          {/* SRS 16.4 and 21.1: the audit metadata an administrator reviews. */}
          <Card>
            <CardHeader>
              <CardTitle>
                <ShieldCheck className="text-muted-foreground size-5" />
                {UI.admin.auditSection}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-1">
                <DetailRow
                  label={UI.service.created}
                  value={formatBusinessDateTime(new Date(service.createdAt), env.APP_TIMEZONE)}
                />
                <DetailRow
                  label={UI.service.lastUpdated}
                  value={formatBusinessDateTime(new Date(service.updatedAt), env.APP_TIMEZONE)}
                />
                <DetailRow
                  label={UI.service.approvedAt}
                  value={
                    service.approvedAt
                      ? `${formatBusinessDateTime(new Date(service.approvedAt), env.APP_TIMEZONE)} · ${service.approvedBy?.name ?? '—'}`
                      : UI.admin.pending
                  }
                />
              </dl>

              {/* SRS 21.2. Two entries today; the table exists so a future state
              needs no redesign, and this list renders whatever it holds. */}
              {history.length > 0 ? (
                <div className="mt-6 space-y-4 border-t border-border/40 pt-5">
                  <p className="text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {UI.admin.statusHistory}
                  </p>
                  <ol className="relative pl-3 space-y-5">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />
                    {history.map((entry) => (
                      <li key={entry.id} className="relative z-10 flex gap-4">
                        <div className="mt-1.5 size-2 rounded-full bg-slate-300 ring-4 ring-card shrink-0" />
                        <div className="space-y-0.5">
                          <p className="text-[14px] font-medium text-foreground">
                            {SERVICE_STATUS_LABELS[entry.toStatus]}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            {formatBusinessDateTime(new Date(entry.changedAt), env.APP_TIMEZONE)} · {entry.changedBy.name}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
