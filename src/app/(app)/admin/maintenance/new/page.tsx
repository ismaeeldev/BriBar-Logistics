/** Record a maintenance entry (ERP roadmap Phase 5, `/admin/maintenance/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createMaintenanceRecordAction } from '@/app/(app)/admin/actions';
import { MaintenanceRecordForm } from '@/components/admin/maintenance-record-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.maintenance.newRecord };

export default async function NewMaintenanceRecordPage() {
  const actor = await requireAdmin();

  const [vehicles, maintenanceTypes] = await Promise.all([
    vehicleRepository.list({ isActive: true }),
    lookupService.list(actor, 'MAINTENANCE_TYPE', { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/maintenance"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.maintenance.title}
      </Link>

      <PageHeader title={UI.admin.maintenance.newRecord} section={UI.nav.sectionFleet} />

      <MaintenanceRecordForm
        action={createMaintenanceRecordAction}
        submitLabel={UI.common.create}
        context={{ vehicles, maintenanceTypes }}
      />
    </div>
  );
}
