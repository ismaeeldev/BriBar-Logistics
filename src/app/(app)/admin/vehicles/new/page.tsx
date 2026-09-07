/** Create a vehicle (SRS 13.3, 17.3 `/admin/vehicles/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createVehicleAction } from '@/app/(app)/admin/actions';
import { VehicleForm } from '@/components/admin/vehicle-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';

export const metadata = { title: UI.admin.newVehicle };

export default async function NewVehiclePage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/vehicles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.vehiclesTitle}
      </Link>

      <PageHeader title={UI.admin.newVehicle} section={UI.nav.sectionMasterData} />

      <VehicleForm action={createVehicleAction} submitLabel={UI.admin.createVehicle} />
    </div>
  );
}
