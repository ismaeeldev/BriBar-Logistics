/**
 * `/api/admin/users/[id]` — read and edit one account (SRS 12.3, 12.4, 18.4).
 *
 * There is no `DELETE`. SRS 8.4 says a user with historical services "shall not
 * be hard-deleted through the normal V1 Admin UI", and SRS 21.5 generalises it
 * to all master data. Deactivation is the removal path, and it is a `PATCH`
 * setting `isActive: false`.
 */
import { requireAdmin } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { updateUserSchema } from '@/modules/users/schemas/user.schema';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';

type Params = { id: string };

export const GET = withRouteHandler<Params>(async (_request, context: RouteContext<Params>) => {
  const actor = await requireAdmin();
  const { id } = await context.params;

  return ok(toUserDto(await userService.getById(actor, id)));
});

export const PATCH = withRouteHandler<Params>(
  async (request, context: RouteContext<Params>) => {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateUserSchema);

    return ok(toUserDto(await userService.update(actor, id, body)));
  },
);
