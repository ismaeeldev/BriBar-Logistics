/**
 * `/api/admin/vehicles/[id]` — read and edit/deactivate (SRS 13.3, 13.4, 18.5).
 *
 * No `DELETE`: a vehicle referenced by a service is preserved (SRS 21.5), and
 * the `onDelete: Restrict` foreign key would refuse the write anyway.
 */
import { requireAdmin } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { updateVehicleSchema } from '@/modules/vehicles/schemas/vehicle.schema';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

type Params = { id: string };

export const GET = withRouteHandler<Params>(async (_request, context: RouteContext<Params>) => {
  const actor = await requireAdmin();
  const { id } = await context.params;

  return ok(await vehicleService.getById(actor, id));
});

export const PATCH = withRouteHandler<Params>(
  async (request, context: RouteContext<Params>) => {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateVehicleSchema);

    return ok(await vehicleService.update(actor, id, body));
  },
);
