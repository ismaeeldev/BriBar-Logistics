/**
 * `/api/services` — list and create (SRS 18.3).
 *
 * Both verbs are open to any authenticated user, and the scoping is done below
 * the handler: `serviceService.list` narrows a driver's results to their own
 * rows in SQL, and `create` decides ownership from the role. There is no
 * separate driver endpoint to keep in step with this one.
 */
import { requireUser } from '@/lib/auth/session';
import { created, ok } from '@/lib/http/api-response';
import { parseJsonBody, parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { Role } from '@/modules/services/domain/service-status';
import {
  adminCreateServiceSchema,
  createServiceSchema,
  serviceFilterSchema,
} from '@/modules/services/schemas/service.schema';
import { serviceService } from '@/modules/services/service/service.service';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

/**
 * SRS 18.3: "Driver gets own services; Admin may get all with filters."
 */
export const GET = withRouteHandler(async (request) => {
  const actor = await requireUser();
  const filters = parseSearchParams(request, serviceFilterSchema);

  const { items, total, pagination } = await serviceService.list(actor, filters);

  return ok(items.map(toServiceListItem), {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  });
});

/**
 * SRS 18.3: "Create a validated Pending Approval service."
 *
 * The schema is chosen by role, not by inspecting the body. An administrator
 * may name the driver (client decision #7); a driver's schema has no such
 * field, so a driver sending `driverId` is rejected rather than silently
 * ignored (SRS 22.4).
 */
export const POST = withRouteHandler(async (request) => {
  const actor = await requireUser();

  const body =
    actor.role === Role.ADMIN
      ? await parseJsonBody(request, adminCreateServiceSchema)
      : await parseJsonBody(request, createServiceSchema);

  const service = await serviceService.create(actor, body);

  return created(toServiceListItem(service));
});
