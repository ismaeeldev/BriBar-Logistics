/**
 * `/api/admin/users` — list and create accounts (SRS 12.1, 12.2, 18.4).
 */
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { created, ok } from '@/lib/http/api-response';
import { parseJsonBody, parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { Role } from '@/modules/services/domain/service-status';
import { booleanSchema } from '@/modules/shared/schemas/common';
import { createUserSchema } from '@/modules/users/schemas/user.schema';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';

const userFilterSchema = z.object({
  role: z.enum(Role).optional(),
  isActive: booleanSchema.optional(),
});

export const GET = withRouteHandler(async (request) => {
  const actor = await requireAdmin();
  const filters = parseSearchParams(request, userFilterSchema);

  const users = await userService.list(actor, filters);

  return ok(users.map(toUserDto));
});

export const POST = withRouteHandler(async (request) => {
  const actor = await requireAdmin();
  const body = await parseJsonBody(request, createUserSchema);

  return created(toUserDto(await userService.create(actor, body)));
});
