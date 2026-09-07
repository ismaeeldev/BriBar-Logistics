'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Bell, CheckCheck, Clock, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LOCALE, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { Role } from '@/modules/services/domain/service-status';
import type { NotificationDto } from '@/modules/notifications/service/notification.presenter';

/**
 * The bell every authenticated header carries (SRS-free — see the schema
 * comment on `Notification` in `prisma/schema.prisma`).
 *
 * Polling rather than a push channel: SRS 4.4 already puts this behind
 * serverless hosting with no long-lived connection to hold one open, and two
 * events a day (a service filed, a service approved) do not justify the
 * infrastructure a socket would need. Thirty seconds is often enough that an
 * administrator notices a new pending service without refreshing, and rare
 * enough that it costs nothing worth measuring.
 */
const POLL_INTERVAL_MS = 30_000;
const DATE_LOCALE = LOCALE === 'en' ? enUS : es;

interface NotificationsResponse {
  data: { items: NotificationDto[]; unreadCount: number };
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = (Date.now() - date.getTime()) / 1000;
  // `formatDistanceToNowStrict` renders anything under a minute as "0 seconds
  // ago", which reads as a bug rather than as recent.
  if (seconds < 45) return UI.notifications.justNow;
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: DATE_LOCALE });
}

export function NotificationBell({ role }: { role: Role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as NotificationsResponse;
      setItems(body.data.items);
      setUnreadCount(body.data.unreadCount);
    } catch {
      // A failed poll is invisible rather than disruptive: the bell keeps
      // whatever it last had until the next successful refresh.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  function markRead(id: string) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((previous) => Math.max(0, previous - 1));
    // Best-effort: fire-and-forget, and the next poll reconciles state either
    // way if this particular request is lost.
    void fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  function markAllRead() {
    if (unreadCount === 0) return;
    setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    void fetch('/api/notifications/read-all', { method: 'POST' });
  }

  function toggle() {
    // The fetch is a side effect kept out of the state updater itself —
    // React may invoke an updater function more than once (StrictMode does,
    // deliberately, to catch exactly this), and a duplicate poll is a cost,
    // not a correctness bug, but there is no reason to court it.
    const next = !isOpen;
    setIsOpen(next);
    if (next) void fetchNotifications();
  }

  const detailHref = (serviceId: string) =>
    role === Role.ADMIN ? `/admin/services/${serviceId}` : `/services/${serviceId}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0 ? UI.notifications.unreadAriaLabel(unreadCount) : UI.notifications.title
        }
        className="hover:bg-muted text-muted-foreground hover:text-foreground relative flex size-10 items-center justify-center rounded-full transition-colors"
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span aria-hidden className="absolute top-1.5 right-1.5 flex size-2.5">
            <span className="bg-destructive animate-ping-soft absolute inline-flex size-full rounded-full opacity-75" />
            <span className="bg-destructive ring-card relative inline-flex size-2.5 rounded-full ring-2" />
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="bg-card animate-rise absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/60 shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">{UI.notifications.title}</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <CheckCheck aria-hidden className="size-3.5" />
                {UI.notifications.markAllRead}
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
                <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
                  <Bell aria-hidden className="size-5" />
                </span>
                <p className="text-sm font-medium">{UI.notifications.empty}</p>
                <p className="text-muted-foreground text-xs">{UI.notifications.emptyHint}</p>
              </div>
            ) : (
              <ul className="divide-border/60 divide-y">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.service ? detailHref(item.service.id) : '#'}
                      onClick={() => {
                        setIsOpen(false);
                        if (!item.isRead) markRead(item.id);
                      }}
                      className={cn(
                        'flex gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                        !item.isRead && 'bg-primary-subtle/40',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                          item.type === 'SERVICE_APPROVED'
                            ? 'bg-approved-surface text-approved'
                            : 'bg-pending-surface text-pending',
                        )}
                      >
                        {item.type === 'SERVICE_APPROVED' ? (
                          <PartyPopper className="size-4" />
                        ) : (
                          <Clock className="size-4" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-foreground truncate text-[13px] font-medium">
                            {item.service
                              ? item.type === 'SERVICE_APPROVED'
                                ? UI.notifications.serviceApprovedTitle(item.service.serviceCode)
                                : UI.notifications.servicePendingTitle(item.service.serviceCode)
                              : UI.notifications.title}
                          </span>
                          {!item.isRead ? (
                            <span
                              aria-hidden
                              className="bg-primary mt-1 size-1.5 shrink-0 rounded-full"
                            />
                          ) : null}
                        </span>

                        {item.service ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.type === 'SERVICE_APPROVED'
                              ? UI.notifications.serviceApprovedBody(item.service.routeCode)
                              : UI.notifications.servicePendingBody(
                                  item.service.driverName,
                                  item.service.routeCode,
                                )}
                          </span>
                        ) : null}

                        <span className="text-muted-foreground mt-0.5 block text-[11px]">
                          {relativeTime(item.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
