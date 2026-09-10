/** Record a refuelling (ERP roadmap Phase 2, `/admin/refuellings/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createRefuellingAction } from '@/app/(app)/admin/actions';
import { RefuellingForm } from '@/components/admin/refuelling-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { Role } from '@/modules/services/domain/service-status';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.refuelling.newRefuelling };

export default async function NewRefuellingPage() {
  const actor = await requireAdmin();

  const [vehicles, drivers, fuelTypes, gasStations, paymentMethods] = await Promise.all([
    vehicleRepository.list({ isActive: true }),
    userRepository.list({ role: Role.DRIVER, isActive: true }),
    lookupService.list(actor, 'FUEL_TYPE', { isActive: true }),
    lookupService.list(actor, 'GAS_STATION', { isActive: true }),
    lookupService.list(actor, 'PAYMENT_METHOD', { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/refuellings"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.refuelling.title}
      </Link>

      <PageHeader title={UI.admin.refuelling.newRefuelling} section={UI.nav.sectionFinance} />

      <RefuellingForm
        action={createRefuellingAction}
        submitLabel={UI.common.create}
        context={{ vehicles, drivers, fuelTypes, gasStations, paymentMethods }}
      />
    </div>
  );
}
