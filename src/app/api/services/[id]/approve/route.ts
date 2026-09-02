/**
 * `/api/services/[id]/approve` — administrator approval (SRS 11.3, 18.3).
 *
 * `requireAdmin` here and a second role check inside `serviceService.approve`.
 * The duplication is deliberate: SRS 11.5 makes the approval boundary an
 * authorisation rule rather than a UI state, and the service layer must be
 * safe to call from anywhere, not only from behind this handler.
 *
 * The body is parsed against an empty strict object, so a request attempting to
 * supply `approvedByUserId` or `approvedAt` is rejected. Both come from the
 * session and the server clock (SRS 22.4).
 */
import { requireAdmin } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { approveServiceSchema } from '@/modules/services/schemas/service.schema';
import { toServiceDetail } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

type Params = { id: string };

export const POST = withRouteHandler<Params>(async (request, context: RouteContext<Params>) => {
  const actor = await requireAdmin();
  const { id } = await context.params;

  // Tolerates a request with no body at all, which is what a plain
  // `fetch(url, { method: 'POST' })` sends.
  const contentLength = request.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    await parseJsonBody(request, approveServiceSchema);
  }

  return ok(toServiceDetail(await serviceService.approve(actor, id)));
});
