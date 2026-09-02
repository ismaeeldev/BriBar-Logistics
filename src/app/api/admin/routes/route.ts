/**
 * `/api/admin/routes` — list and create routes/contracts (SRS 14.2, 18.6).
 *
 * Administrator-only, unlike vehicles. A driver never needs the full catalogue:
 * SRS 14.3 restricts them to their assignments, which `/api/service-context`
 * supplies. Exposing every route here would publish the client's contract list
 * to any signed-in driver for no operational gain.
 */
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { created, ok } from '@/lib/http/api-response';
import { parseJsonBody, parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { createRouteSchema } from '@/modules/routes/schemas/route.schema';
import { routeService } from '@/modules/routes/service/route.service';
import { booleanSchema } from '@/modules/shared/schemas/common';

const routeFilterSchema = z.object({ isActive: booleanSchema.optional() });

export const GET = withRouteHandler(async (request) => {
  const actor = await requireAdmin();
  const filters = parseSearchParams(request, routeFilterSchema);

  return ok(await routeService.list(actor, filters));
});

export const POST = withRouteHandler(async (request) => {
  const actor = await requireAdmin();
  const body = await parseJsonBody(request, createRouteSchema);

  return created(await routeService.create(actor, body));
});
