/**
 * `/api/admin/vehicles` — list and create (SRS 13.2, 13.3, 18.5).
 *
 * The list is reachable by a driver as well, because SRS 12.5 lets a driver
 * pick any active vehicle and the Add Service form needs the options. The
 * service layer overrides the filter for a non-admin, so a driver receives only
 * active vehicles regardless of what they ask for (SRS 13.4).
 */
import { z } from 'zod';

import { requireAdmin, requireUser } from '@/lib/auth/session';
import { created, ok } from '@/lib/http/api-response';
import { parseJsonBody, parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { booleanSchema } from '@/modules/shared/schemas/common';
import { createVehicleSchema } from '@/modules/vehicles/schemas/vehicle.schema';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

const vehicleFilterSchema = z.object({ isActive: booleanSchema.optional() });

export const GET = withRouteHandler(async (request) => {
  const actor = await requireUser();
  const filters = parseSearchParams(request, vehicleFilterSchema);

  return ok(await vehicleService.list(actor, filters));
});

export const POST = withRouteHandler(async (request) => {
  const actor = await requireAdmin();
  const body = await parseJsonBody(request, createVehicleSchema);

  return created(await vehicleService.create(actor, body));
});
