/**
 * Admin service edit (SRS 11.4, 21.3, 17.3).
 *
 * An administrator may edit in either state. Editing an approved service does
 * not change its status and does not restore the driver's access - both fall
 * out of `canEdit` taking the actor's role rather than a per-service flag.
 *
 * The same `ServiceForm` the driver uses, with the same action. The only
 * difference is the context: it is loaded for the service's *owner*, so the
 * route picker offers that driver's assignments rather than nothing (an
 * administrator has no route assignments of their own).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { updateServiceAction } from '@/app/(app)/services/actions';
import { ServiceForm } from '@/components/services/service-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import {
  toServiceContextDto,
  toServiceDetail,
} from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: UI.service.editTitle };

export default async function AdminEditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;

  let service;
  try {
    service = toServiceDetail(await serviceService.getById(actor, id));
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const context = await serviceService.getContext(actor, service.driver.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href={`/admin/services/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.service.backToService}
      </Link>

      <PageHeader
        title={UI.service.editTitle}
        section={UI.nav.sectionOperations}
        description={`#${service.serviceCode} · ${service.driver.name}`}
      />

      {/* SRS 21.3: an edit after approval is a correction to a signed-off
          record. Saying so before the fact is better than only auditing it
          after. */}
      {service.status === ServiceStatus.APPROVED ? (
        <Alert tone="warning" title={UI.admin.editingApproved}>
          {UI.admin.editingApprovedHint}
        </Alert>
      ) : null}

      <ServiceForm
        context={toServiceContextDto(context)}
        action={updateServiceAction.bind(null, id, 'admin')}
        submitLabel={UI.common.save}
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
