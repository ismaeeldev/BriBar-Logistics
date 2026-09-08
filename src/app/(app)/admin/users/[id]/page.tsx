/**
 * Edit an account (SRS 12.3, 12.4, 12.5, 12.6, 17.3 `/admin/users/[id]`).
 *
 * "Edit user, active status, default vehicle, assigned routes, and default
 * route." All four in one form; the action writes the account and the route
 * assignments as two service calls so each produces its own audit entry.
 *
 * SRS 8.4 forbids hard-deleting a user with historical services, and SRS 21.5
 * generalises it — so deactivation stays the removal path for anyone who has
 * filed or approved a service, and the toggle on this form is how. Delete is
 * offered only for an account with no history at all: one created by mistake,
 * or for someone who never started.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteRecord } from '@/components/admin/delete-record';
import { deleteUserAction, updateUserAction } from '@/app/(app)/admin/actions';
import { UserForm } from '@/components/admin/user-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';
import { type Role } from '@/modules/services/domain/service-status';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

export const metadata = { title: UI.admin.editAccount };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;

  let user;
  try {
    user = toUserDto(await userService.getById(actor, id));
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const [routes, vehicles, deletability] = await Promise.all([
    routeService.list(actor, { isActive: true }),
    vehicleService.list(actor, { isActive: true }),
    userService.getDeletability(actor, id),
  ]);

  /**
   * A route this driver holds that has since been deactivated stays in the
   * list, so an administrator can see why it no longer appears in the driver's
   * picker. Filtering it out silently would make the assignment look lost.
   */
  const inactiveAssigned = user.assignedRoutes.filter((route) => !route.isActive);

  const routeOptions = [
    ...routes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      isActive: true,
    })),
    ...inactiveAssigned.map((route) => ({
      id: route.id,
      code: route.code,
      name: `${route.name} ${UI.common.inactiveMarker}`,
      isActive: false,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.nav.drivers}
      </Link>

      <PageHeader
        title={UI.admin.editAccount}
        section={UI.nav.sectionMasterData}
        description={user.name}
      />

      {inactiveAssigned.length > 0 ? (
        <Alert tone="warning" title={UI.admin.inactiveRoutesTitle}>
          {UI.admin.inactiveRoutesHint(inactiveAssigned.length)}
        </Alert>
      ) : null}

      <UserForm
        action={updateUserAction.bind(null, id)}
        submitLabel={UI.common.save}
        isSelf={user.id === actor.userId}
        routes={routeOptions}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          registrationPlate: vehicle.registrationPlate,
          referenceName: vehicle.referenceName,
        }))}
        initial={{
          name: user.name,
          loginIdentifier: user.loginIdentifier,
          role: user.role as Role,
          isActive: user.isActive,
          defaultVehicleId: user.defaultVehicle?.id ?? null,
          assignments: user.assignedRoutes.map((route) => ({
            routeId: route.id,
            isDefault: route.isDefault,
          })),
        }}
      />

      <DeleteRecord
        action={deleteUserAction.bind(null, id)}
        name={user.name}
        deletability={deletability}
      />
    </div>
  );
}
