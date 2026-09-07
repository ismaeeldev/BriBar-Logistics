/**
 * Database access for notifications.
 *
 * Not an SRS module (see the schema comment in `prisma/schema.prisma`) — a
 * small, purpose-built inbox for two events: a service waiting on an
 * administrator, and a service just approved for its driver.
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  isRead: true,
  createdAt: true,
  service: {
    select: {
      id: true,
      serviceCode: true,
      driver: { select: { id: true, name: true } },
      route: { select: { code: true } },
    },
  },
} satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_SELECT;
}>;

export const notificationRepository = {
  /** The bell's own query: this recipient's notifications, newest first. */
  async listForRecipient(
    recipientUserId: string,
    limit: number,
    client: PrismaClientLike = prisma,
  ): Promise<NotificationRecord[]> {
    return client.notification.findMany({
      where: { recipientUserId },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async countUnread(
    recipientUserId: string,
    client: PrismaClientLike = prisma,
  ): Promise<number> {
    return client.notification.count({ where: { recipientUserId, isRead: false } });
  },

  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<{ id: string; recipientUserId: string; isRead: boolean } | null> {
    return client.notification.findUnique({
      where: { id },
      select: { id: true, recipientUserId: true, isRead: true },
    });
  },

  async markRead(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllRead(recipientUserId: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.notification.updateMany({
      where: { recipientUserId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  /**
   * Every active administrator's id — who `notifyAdminsOfPendingService`
   * writes to. Read fresh inside the caller's transaction, same reasoning as
   * every other actor lookup in this codebase: a deactivated administrator
   * should not receive a fresh notification even if the transaction that
   * deactivated them has not yet committed elsewhere.
   */
  async activeAdminIds(client: PrismaClientLike = prisma): Promise<string[]> {
    const admins = await client.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    return admins.map((admin) => admin.id);
  },

  /** Written inside the transaction that produced the event, never alone. */
  async createMany(
    entries: Prisma.NotificationCreateManyInput[],
    client: PrismaClientLike = prisma,
  ): Promise<void> {
    if (entries.length === 0) return;
    await client.notification.createMany({ data: entries });
  },
} as const;

export type NotificationRepository = typeof notificationRepository;
