/**
 * Notification orchestration.
 *
 * Two producers, both existing workflow transactions rather than a new one:
 * `serviceService.create` calls `notifyAdminsOfPendingService`, and
 * `serviceService.approve` calls `notifyDriverOfApproval`. Both run inside the
 * caller's `prisma.$transaction`, for the same reason the audit write does —
 * a service and the notification describing it must commit together, or not
 * at all.
 */
import { NotificationType } from '@prisma/client';

import type { Actor } from '@/lib/auth/session';
import type { PrismaTransactionClient } from '@/lib/db/prisma';
import { forbidden, notFound } from '@/lib/errors/app-error';
import { notificationRepository, type NotificationRecord } from '../repository/notification.repository';

export interface NotificationSummary {
  items: NotificationRecord[];
  unreadCount: number;
}

export const notificationService = {
  /** The bell's own read: this actor's recent notifications, and how many are unread. */
  async list(actor: Actor, limit: number): Promise<NotificationSummary> {
    const [items, unreadCount] = await Promise.all([
      notificationRepository.listForRecipient(actor.userId, limit),
      notificationRepository.countUnread(actor.userId),
    ]);

    return { items, unreadCount };
  },

  /**
   * Marks one notification read. Scoped to its recipient — an administrator
   * has no more business clearing a driver's notification than editing their
   * password, and there is no operational reason for one to.
   */
  async markRead(actor: Actor, id: string): Promise<void> {
    const existing = await notificationRepository.findById(id);
    if (!existing) throw notFound();
    if (existing.recipientUserId !== actor.userId) throw forbidden();
    if (existing.isRead) return;

    await notificationRepository.markRead(id);
  },

  async markAllRead(actor: Actor): Promise<void> {
    await notificationRepository.markAllRead(actor.userId);
  },

  /**
   * Every active administrator learns a service is waiting on them, except
   * the actor themselves — relevant when an administrator files a service on
   * a driver's behalf and would otherwise be notified of their own write.
   */
  async notifyAdminsOfPendingService(
    tx: PrismaTransactionClient,
    params: { serviceId: string; actorUserId: string },
  ): Promise<void> {
    const adminIds = await notificationRepository.activeAdminIds(tx);
    const recipients = adminIds.filter((id) => id !== params.actorUserId);

    await notificationRepository.createMany(
      recipients.map((recipientUserId) => ({
        recipientUserId,
        type: NotificationType.SERVICE_PENDING_APPROVAL,
        serviceId: params.serviceId,
      })),
      tx,
    );
  },

  /** The driver whose service just cleared review learns without reopening it. */
  async notifyDriverOfApproval(
    tx: PrismaTransactionClient,
    params: { serviceId: string; driverId: string },
  ): Promise<void> {
    await notificationRepository.createMany(
      [
        {
          recipientUserId: params.driverId,
          type: NotificationType.SERVICE_APPROVED,
          serviceId: params.serviceId,
        },
      ],
      tx,
    );
  },
} as const;

export type NotificationService = typeof notificationService;
