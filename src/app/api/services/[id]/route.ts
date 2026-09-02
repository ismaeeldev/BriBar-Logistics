/**
 * `/api/services/[id]` — read and edit one service (SRS 18.3).
 *
 * Access is "owning Driver or ADMIN" for the read and "pending owner Driver or
 * ADMIN" for the edit. Neither is decided here: `serviceService` re-reads the
 * record and asks the domain predicates, so a request that guesses an id gets
 * the same 404 as one for a service that does not exist (SRS 8.3, 24.3).
 */
import { requireUser } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { updateServiceSchema } from '@/modules/services/schemas/service.schema';
import { toServiceDetail } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

type Params = { id: string };

export const GET = withRouteHandler<Params>(async (_request, context: RouteContext<Params>) => {
  const actor = await requireUser();
  const { id } = await context.params;

  return ok(toServiceDetail(await serviceService.getById(actor, id)));
});

/**
 * SRS 18.3: "Edit service and recalculate mileage."
 *
 * The recalculation is unconditional — `serviceService.update` recomputes both
 * values from the submitted readings and the schema has no field for either
 * (SRS 10.4, 22.4).
 *
 * A driver whose service was approved between page load and save receives 409
 * with an explanatory message rather than a silent overwrite or a generic
 * failure (SRS 24.4).
 */
export const PATCH = withRouteHandler<Params>(
  async (request, context: RouteContext<Params>) => {
    const actor = await requireUser();
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateServiceSchema);

    return ok(toServiceDetail(await serviceService.update(actor, id, body)));
  },
);
