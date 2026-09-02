/**
 * Edit a service (SRS 17.2 `/services/[id]/edit`).
 *
 * "Driver access: only owning Driver when status = Pending Approval. Server
 * rule: access must be revalidated at request time; a service becoming Approved
 * must immediately become non-editable to the Driver."
 *
 * Hence the check below runs on every render rather than relying on how the
 * user arrived. And it is only the first of three: the server action re-checks,
 * and the update itself is guarded by the status in its SQL `where` clause, so
 * an approval landing mid-edit cannot be overwritten (SRS 24.4).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { updateServiceAction } from '@/app/(app)/services/actions';
import { ServiceForm } from '@/components/services/service-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { canEdit } from '@/modules/services/domain/service-status';
import {
  toServiceContextDto,
  toServiceDetail,
} from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: 'Editar servicio' };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const { id } = await params;

  let service;
  try {
    service = toServiceDetail(await serviceService.getById(actor, id));
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  if (!canEdit(actor, { driverId: service.driver.id, status: service.status })) {
    // Approved between the driver opening the list and following the link.
    // Redirecting to the detail page is more useful than an error: they can
    // still read the record, which is what SRS 11.4 preserves.
    redirect(`/services/${id}`);
  }

  const context = await serviceService.getContext(actor, service.driver.id);

  return (
    <div className="space-y-5">
      <Link
        href={`/services/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Volver al servicio
      </Link>

      <PageHeader title="Editar servicio" description={`#${service.serviceCode}`} />

      <ServiceForm
        context={toServiceContextDto(context)}
        action={updateServiceAction.bind(null, id, 'driver')}
        submitLabel="Guardar cambios"
        serviceCode={service.serviceCode}
        initialValues={{
          vehicleId: service.vehicle.id,
          routeId: service.route.id,
          startDashboardKm: String(service.startDashboardKm),
          startBaseKm: String(service.startBaseKm),
          endBaseKm: String(service.endBaseKm),
          endDashboardKm: String(service.endDashboardKm),
          departureTime: service.departureTime,
          arrivalTime: service.arrivalTime,
          endsNextDay: service.endsNextDay,
          sites: service.sites ?? '',
          observations: service.observations ?? '',
        }}
      />
    </div>
  );
}
