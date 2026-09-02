/**
 * `/api/admin/users/[id]/routes` — replace a driver's route assignments
 * (SRS 12.6, 18.4).
 *
 * `PUT` rather than `POST`/`DELETE` per assignment, because "exactly one
 * default" is a property of the whole set. Moving the default from one route to
 * another through individual mutations would require an intermediate state with
 * either two defaults or none, and the partial unique index forbids the first.
 * Replacing the set atomically avoids the question.
 */
import { requireAdmin } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { replaceRouteAssignmentsSchema } from '@/modules/users/schemas/user.schema';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';

type Params = { id: string };

export const PUT = withRouteHandler<Params>(async (request, context: RouteContext<Params>) => {
  const actor = await requireAdmin();
  const { id } = await context.params;
  const body = await parseJsonBody(request, replaceRouteAssignmentsSchema);

  return ok(toUserDto(await userService.replaceRouteAssignments(actor, id, body)));
});
