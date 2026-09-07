/**
 * `/api/notifications/[id]/read` — marks one notification read.
 *
 * Mirrors `/api/services/[id]/approve`: an action endpoint rather than a
 * generic `PATCH`, because "mark read" is the only edit a notification ever
 * gets — there is no form behind it, so a body-shaped update would invent a
 * request format nothing produces.
 */
import { requireUser } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseJsonBody, withRouteHandler, type RouteContext } from '@/lib/http/route-handler';
import { markNotificationReadSchema } from '@/modules/notifications/schemas/notification.schema';
import { notificationService } from '@/modules/notifications/service/notification.service';

type Params = { id: string };

export const POST = withRouteHandler<Params>(async (request, context: RouteContext<Params>) => {
  const actor = await requireUser();
  const { id } = await context.params;

  // Tolerates a bare `fetch(url, { method: 'POST' })` with no body.
  const contentLength = request.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    await parseJsonBody(request, markNotificationReadSchema);
  }

  await notificationService.markRead(actor, id);

  return ok({ success: true });
});
