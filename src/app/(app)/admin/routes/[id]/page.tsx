/**
 * Edit a route/contract (SRS 14.2, 17.3 `/admin/routes/[id]`).
 *
 * The assigned-driver count is loaded so the deactivation hint can say how many
 * people the change affects, before it is made rather than after one of them
 * reports a missing route.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteRouteAction, updateRouteAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { RouteForm } from '@/components/admin/route-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';

export const metadata = { title: UI.admin.editRoute };

export default async function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;

  let route;
  let assignedDriverCount;
  try {
    [route, assignedDriverCount] = await Promise.all([
      routeService.getById(actor, id),
      routeService.countAssignedDrivers(actor, id),
    ]);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  // A route no service ever ran can be deleted; one with history is
  // deactivated instead, and the control says which this is.
  const deletability = await routeService.getDeletability(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/routes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.routesTitle}
      </Link>

      <PageHeader
        title={UI.admin.editRoute}
        section={UI.nav.sectionMasterData}
        description={`${route.code} · ${route.name}`}
      />

      <RouteForm
        action={updateRouteAction.bind(null, id)}
        submitLabel={UI.common.save}
        assignedDriverCount={assignedDriverCount}
        initial={{
          code: route.code,
          name: route.name,
          origin: route.origin,
          destination: route.destination,
          isActive: route.isActive,
          defaultRateCents: route.defaultRateCents,
        }}
      />

      <DeleteRecord
        action={deleteRouteAction.bind(null, id)}
        name={route.code}
        deletability={deletability}
      />
    </div>
  );
}
