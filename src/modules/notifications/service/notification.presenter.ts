/**
 * The shape the notification API returns.
 *
 * Same reasoning as `service.presenter.ts`: a Prisma row is not JSON
 * (`createdAt` is a `Date`), and the wire format should name its fields rather
 * than publish whatever the repository's select happens to include.
 */
import type { NotificationRecord } from '../repository/notification.repository';

export interface NotificationDto {
  id: string;
  type: 'SERVICE_PENDING_APPROVAL' | 'SERVICE_APPROVED';
  isRead: boolean;
  /** ISO instant; the bell renders it relative to now. */
  createdAt: string;
  /** Null only if the service it described has since been removed. */
  service: {
    id: string;
    serviceCode: string;
    driverName: string;
    routeCode: string;
  } | null;
}

export function toNotificationDto(notification: NotificationRecord): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    service: notification.service
      ? {
          id: notification.service.id,
          serviceCode: notification.service.serviceCode,
          driverName: notification.service.driver.name,
          routeCode: notification.service.route.code,
        }
      : null,
  };
}
