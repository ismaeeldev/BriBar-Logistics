/** Create a vehicle (SRS 13.3, 17.3 `/admin/vehicles/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createVehicleAction } from '@/app/(app)/admin/actions';
import { VehicleForm } from '@/components/admin/vehicle-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';

export const metadata = { title: 'Nuevo vehículo' };

export default async function NewVehiclePage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/vehicles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Vehículos
      </Link>

      <PageHeader title="Nuevo vehículo" />

      <VehicleForm action={createVehicleAction} submitLabel="Crear vehículo" />
    </div>
  );
}
