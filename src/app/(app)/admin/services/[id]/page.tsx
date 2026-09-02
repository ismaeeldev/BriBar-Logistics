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
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApproveButton } from '@/components/admin/approve-button';
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
import { toServiceDetail } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: UI.admin.reviewTitle };

export default async function AdminServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let service;
  let history;
  try {
    service = toServiceDetail(await serviceService.getById(actor, id));
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

      <Card>
        <CardHeader>
          <CardTitle>{UI.service.mileageSection}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="bg-muted grid grid-cols-2 gap-3 rounded-lg p-3">
            <div>
              <p className="text-muted-foreground text-xs">{FIELD_LABELS.actualKm}</p>
              <p className="font-mono text-2xl font-semibold">{service.actualKm}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{FIELD_LABELS.serviceKm}</p>
              <p className="font-mono text-2xl font-semibold">{service.serviceKm}</p>
            </div>
          </div>

          <dl className="divide-y">
            <DetailRow
              label={FIELD_LABELS.startDashboardKm}
              value={service.startDashboardKm}
              mono
            />
            <DetailRow label={FIELD_LABELS.startBaseKm} value={service.startBaseKm} mono />
            <DetailRow label={FIELD_LABELS.endBaseKm} value={service.endBaseKm} mono />
            <DetailRow
              label={FIELD_LABELS.endDashboardKm}
              value={service.endDashboardKm}
              mono
            />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{UI.service.routeSection}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y">
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
                  <span className="font-mono">{service.vehicle.registrationPlate}</span>
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
          <CardTitle>{UI.service.timesSection}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y">
            <DetailRow label={FIELD_LABELS.departureTime} value={service.departureTime} mono />
            <DetailRow
              label={FIELD_LABELS.arrivalTime}
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono">{service.arrivalTime}</span>
                  {service.endsNextDay ? (
                    <span className="text-muted-foreground text-xs">{UI.service.nextDay}</span>
                  ) : null}
                </span>
              }
            />
          </dl>
        </CardBody>
      </Card>

      {service.sites || service.observations ? (
        <Card>
          <CardHeader>
            <CardTitle>{UI.service.driverNotesSection}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
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

      {/* SRS 16.4 and 21.1: the audit metadata an administrator reviews. */}
      <Card>
        <CardHeader>
          <CardTitle>{UI.admin.auditSection}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y">
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
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="text-muted-foreground text-xs font-medium">
                {UI.admin.statusHistory}
              </p>
              <ol className="space-y-1.5">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {formatBusinessDateTime(new Date(entry.changedAt), env.APP_TIMEZONE)}
                    </span>
                    <span>
                      {SERVICE_STATUS_LABELS[entry.toStatus]}
                      <span className="text-muted-foreground"> · {entry.changedBy.name}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
