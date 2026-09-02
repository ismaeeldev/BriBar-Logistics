/**
 * `/api/admin/routes/[id]` — read and edit a route (SRS 14.2, 18.6).
 *
 * Editing origin or destination is explicitly permitted at any time (SRS 14.2)
 * and deliberately does not touch existing services: each carries its own
 * snapshot, so SRS 21.4's "historical services must not silently change" holds
 * without this endpoint needing to know about it.
 */
import { requireAdmin } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { updateRouteSchema } from '@/modules/routes/schemas/route.schema';
import { routeService } from '@/modules/routes/service/route.service';

type Params = { id: string };

export const GET = withRouteHandler<Params>(async (_request, context: RouteContext<Params>) => {
  const actor = await requireAdmin();
  const { id } = await context.params;

  const [route, assignedDriverCount] = await Promise.all([
    routeService.getById(actor, id),
    routeService.countAssignedDrivers(actor, id),
  ]);

  // The count lets the admin screen say how many drivers a deactivation will
  // affect, before it happens rather than after someone reports a missing
  // route.
  return ok({ ...route, assignedDriverCount });
});

export const PATCH = withRouteHandler<Params>(
  async (request, context: RouteContext<Params>) => {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateRouteSchema);

    return ok(await routeService.update(actor, id, body));
  },
);
