/**
 * Edit an account (SRS 12.3, 12.4, 12.5, 12.6, 17.3 `/admin/users/[id]`).
 *
 * "Edit user, active status, default vehicle, assigned routes, and default
 * route." All four in one form; the action writes the account and the route
 * assignments as two service calls so each produces its own audit entry.
 *
 * No delete: SRS 8.4 forbids hard-deleting a user with historical services
 * through the admin UI, and SRS 21.5 generalises it. Deactivation is the
 * removal path and it is the toggle on this page.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { updateUserAction } from '@/app/(app)/admin/actions';
import { UserForm } from '@/components/admin/user-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { routeService } from '@/modules/routes/service/route.service';
import { type Role } from '@/modules/services/domain/service-status';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

export const metadata = { title: 'Editar cuenta' };

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

  const [routes, vehicles] = await Promise.all([
    routeService.list(actor, { isActive: true }),
    vehicleService.list(actor, { isActive: true }),
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
      name: `${route.name} (inactiva)`,
      isActive: false,
    })),
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Conductores
      </Link>

      <PageHeader title="Editar cuenta" description={user.name} />

      {inactiveAssigned.length > 0 ? (
        <Alert tone="warning" title="Rutas inactivas asignadas">
          Este conductor tiene {inactiveAssigned.length}{' '}
          {inactiveAssigned.length === 1 ? 'ruta desactivada' : 'rutas desactivadas'}. No
          aparecerán al crear un servicio hasta que se reactiven.
        </Alert>
      ) : null}

      <UserForm
        action={updateUserAction.bind(null, id)}
        submitLabel="Guardar cambios"
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
    </div>
  );
}
