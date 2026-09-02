/**
 * Edit a vehicle (SRS 13.3, 13.4, 17.3 `/admin/vehicles/[id]`).
 *
 * No delete action, deliberately: SRS 21.5 makes deactivation the removal
 * path, and the `onDelete: Restrict` foreign keys would refuse the write for
 * any vehicle attached to a service.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { updateVehicleAction } from '@/app/(app)/admin/actions';
import { VehicleForm } from '@/components/admin/vehicle-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

export const metadata = { title: UI.admin.editVehicle };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;

  let vehicle;
  try {
    vehicle = await vehicleService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/vehicles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.vehiclesTitle}
      </Link>

      <PageHeader title={UI.admin.editVehicle} description={vehicle.registrationPlate} />

      <VehicleForm
        action={updateVehicleAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{
          registrationPlate: vehicle.registrationPlate,
          referenceName: vehicle.referenceName,
          isActive: vehicle.isActive,
        }}
      />
    </div>
  );
}
