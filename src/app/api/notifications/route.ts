/**
 * `/api/notifications` — the bell's own list.
 *
 * Any authenticated user, not just an administrator: a driver receives
 * "service approved" notifications, and this endpoint is how their bell reads
 * them. Scoping to `actor.userId` happens inside `notificationService.list`,
 * not here — the same reasoning as every other list endpoint in this
 * codebase, so a handler can never accidentally serve someone else's rows.
 */
import { requireUser } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { parseSearchParams, withRouteHandler } from '@/lib/http/route-handler';
import { notificationListQuerySchema } from '@/modules/notifications/schemas/notification.schema';
import { toNotificationDto } from '@/modules/notifications/service/notification.presenter';
import { notificationService } from '@/modules/notifications/service/notification.service';

export const GET = withRouteHandler(async (request) => {
  const actor = await requireUser();
  const { limit } = parseSearchParams(request, notificationListQuerySchema);

  const { items, unreadCount } = await notificationService.list(actor, limit);

  return ok({ items: items.map(toNotificationDto), unreadCount });
});
