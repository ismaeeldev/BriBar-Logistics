/**
 * Create an account (SRS 12.2, 17.3 `/admin/users/new`).
 *
 * The vehicle and route options are loaded server-side and filtered to active
 * ones: assigning an already-deactivated route or vehicle is rejected by the
 * service layer, so offering it would only produce an error the administrator
 * could not have predicted.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createUserAction } from '@/app/(app)/admin/actions';
import { UserForm } from '@/components/admin/user-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

export const metadata = { title: UI.admin.newAccount };

export default async function NewUserPage() {
  const actor = await requireAdmin();

  const [routes, vehicles] = await Promise.all([
    routeService.list(actor, { isActive: true }),
    vehicleService.list(actor, { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.nav.drivers}
      </Link>

      <PageHeader title={UI.admin.newAccount} section={UI.nav.sectionMasterData} />

      <UserForm
        action={createUserAction}
        submitLabel={UI.admin.createAccount}
        routes={routes.map((route) => ({
          id: route.id,
          code: route.code,
          name: route.name,
          isActive: route.isActive,
        }))}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          registrationPlate: vehicle.registrationPlate,
          referenceName: vehicle.referenceName,
        }))}
      />
    </div>
  );
}
