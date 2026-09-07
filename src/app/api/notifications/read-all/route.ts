/**
 * `/api/notifications/read-all` — clears every unread notification for the
 * current user in one request, for the dropdown's "mark all as read".
 */
import { requireUser } from '@/lib/auth/session';
import { ok } from '@/lib/http/api-response';
import { withRouteHandler } from '@/lib/http/route-handler';
import { notificationService } from '@/modules/notifications/service/notification.service';

export const POST = withRouteHandler(async () => {
  const actor = await requireUser();
  await notificationService.markAllRead(actor);

  return ok({ success: true });
});
