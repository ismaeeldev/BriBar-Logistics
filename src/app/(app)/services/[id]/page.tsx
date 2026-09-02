/**
 * Service detail (SRS 16.4, 17.2 `/services/[id]`).
 *
 * Access is "owning Driver or Admin", decided by `serviceService.getById`,
 * which scopes the query by driver for a non-admin — a guessed id yields the
 * same 404 as a service that does not exist (SRS 24.3).
 */
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  ServiceStatusBadge,
} from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS } from '@/lib/i18n/messages';
import { formatBusinessDate, formatBusinessDateTime } from '@/lib/time/business-date';
import { canEdit } from '@/modules/services/domain/service-status';
import { toServiceDetail } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: 'Detalle del servicio' };

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const flags = await searchParams;

  let service;
  try {
    service = toServiceDetail(await serviceService.getById(actor, id));
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  // Asked of the domain layer, exactly as the API asks it. The button and the
  // endpoint therefore cannot disagree about who may edit (SRS 11.5).
  const editable = canEdit(actor, { driverId: service.driver.id, status: service.status });

  return (
    <div className="space-y-5">
      <Link
        href="/services"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Historial
      </Link>

      {/* SRS 23.3: "confirmation feedback after successful submission". */}
      {flags.created ? (
        <Alert tone="success" title="Servicio enviado">
          Su servicio está pendiente de aprobación.
        </Alert>
      ) : null}
      {flags.updated ? <Alert tone="success" title="Cambios guardados" /> : null}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
              #{service.serviceCode}
            </h1>
            <ServiceStatusBadge status={service.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {formatBusinessDate(service.serviceDate)}
          </p>
        </div>

        {editable ? (
          <Link
            href={`/services/${service.id}/edit`}
            className="border-input bg-card hover:bg-muted inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            <Pencil aria-hidden className="size-4" />
            Editar
          </Link>
        ) : null}
      </div>

      {/* SRS 11.4: a driver keeps read access after approval but loses editing.
          Saying so beats silently removing the button. */}
      {!editable && service.status === 'APPROVED' ? (
        <Alert tone="info">
          Este servicio está aprobado. Para cualquier corrección, contacte con un administrador.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kilometraje</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* The two numbers the business signs off on, given the most weight. */}
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
          <CardTitle>Ruta y vehículo</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y">
            <DetailRow
              label={FIELD_LABELS.route}
              value={
                <span>
                  {service.route.code}
                  <span className="text-muted-foreground"> · {service.route.name}</span>
                </span>
              }
            />
            {/* The snapshot, not the route's current values (SRS 14.5). */}
            <DetailRow label={FIELD_LABELS.origin} value={service.origin} />
            <DetailRow label={FIELD_LABELS.destination} value={service.destination} />
            <DetailRow
              label={FIELD_LABELS.vehicle}
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono">{service.vehicle.registrationPlate}</span>
                  {/* SRS 13.4: a deactivated vehicle stays visible on its
                      historical services, and is marked rather than hidden. */}
                  {!service.vehicleIsActive ? (
                    <span className="text-muted-foreground text-xs">(dado de baja)</span>
                  ) : null}
                </span>
              }
            />
            <DetailRow label={FIELD_LABELS.driver} value={service.driver.name} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario</CardTitle>
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
                    <span className="text-muted-foreground text-xs">(día siguiente)</span>
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
            <CardTitle>Notas</CardTitle>
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

      {/* SRS 16.4: creation, last update, and the approval metadata. Rendered
          in APP_TIMEZONE; the columns are UTC (SRS 31.3). */}
      <Card>
        <CardHeader>
          <CardTitle>Registro</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y">
            <DetailRow
              label="Creado"
              value={formatBusinessDateTime(new Date(service.createdAt), env.APP_TIMEZONE)}
            />
            <DetailRow
              label="Última modificación"
              value={formatBusinessDateTime(new Date(service.updatedAt), env.APP_TIMEZONE)}
            />
            {service.approvedAt ? (
              <DetailRow
                label="Aprobado"
                value={`${formatBusinessDateTime(new Date(service.approvedAt), env.APP_TIMEZONE)} · ${
                  service.approvedBy?.name ?? '—'
                }`}
              />
            ) : null}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
