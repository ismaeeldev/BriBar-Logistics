/**
 * `/api/service-context` — everything the Add Service screen preselects
 * (SRS 9.2, 18.3).
 *
 * "Return authenticated Driver, default vehicle, assigned routes and default
 * route context for Add Service."
 *
 * The point of a dedicated endpoint is that the browser never assembles this
 * itself. If the form fetched vehicles and routes separately and picked the
 * defaults client-side, the set of routes a driver may choose would be a
 * client-side decision — and SRS 14.3 makes it a server-side one.
 *
 * SRS 24.2 requires an actionable message when a driver is not configured, so
 * an unconfigured driver gets a 409 naming what an administrator must do rather
 * than an empty form.
 */
import { requireUser } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { uuidSchema } from '@/modules/shared/schemas/common';
import { toServiceContextDto } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';
import { z } from 'zod';

/**
 * `driverId` is honoured only for an administrator filing on someone's behalf
 * (client decision #7). `serviceService.getContext` ignores it for a driver, so
 * a driver appending it to the URL still gets their own context.
 */
const contextQuerySchema = z.object({
  driverId: uuidSchema.optional(),
});

export const GET = withRouteHandler(async (request) => {
  const actor = await requireUser();
  const { driverId } = parseSearchParams(request, contextQuerySchema);

  const context = await serviceService.getContext(actor, driverId);

  // The same DTO the pages hand to the form, so both doors return an
  // identical shape (SRS 31.3: a calendar day, not an instant).
  return ok(toServiceContextDto(context));
});
