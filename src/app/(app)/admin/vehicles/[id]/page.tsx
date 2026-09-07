/**
 * Edit a vehicle (SRS 13.3, 13.4, 17.3 `/admin/vehicles/[id]`).
 *
 * Deactivation is still the removal path for a vehicle that has been used
 * (SRS 21.5), and the `onDelete: Restrict` foreign keys enforce that whatever
 * this page offers. Delete exists for the other case: a plate typed wrong, a
 * vehicle added and never driven. `getDeletability` decides which of the two
 * the administrator is looking at before the control is drawn.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteVehicleAction, updateVehicleAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
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

  const deletability = await vehicleService.getDeletability(actor, id);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/vehicles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.vehiclesTitle}
      </Link>

      <PageHeader
        title={UI.admin.editVehicle}
        section={UI.nav.sectionMasterData}
        description={vehicle.registrationPlate}
      />

      <VehicleForm
        action={updateVehicleAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{
          registrationPlate: vehicle.registrationPlate,
          referenceName: vehicle.referenceName,
          isActive: vehicle.isActive,
        }}
      />

      <DeleteRecord
        action={deleteVehicleAction.bind(null, id)}
        name={vehicle.registrationPlate}
        deletability={deletability}
      />
    </div>
  );
}
