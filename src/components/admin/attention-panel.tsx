import { AlertTriangle, ChevronRight, Clock, ClipboardCheck, Gauge } from 'lucide-react';
import Link from 'next/link';

import { UI } from '@/lib/i18n/messages';
import { formatBusinessDate } from '@/lib/time/business-date';
import type { DashboardException } from '@/modules/services/service/dashboard';

/**
 * What needs an administrator before anything else does.
 *
 * A dashboard made of counts tells someone how the fleet is doing. It does not
 * tell them what to *do*, and for an operations screen that is the more useful
 * half. This panel is the answer to "what needs me", and it is deliberately
 * the second thing on the page — after the headline figures, before every
 * chart and list.
 *
 * ## It has to be allowed to be empty
 *
 * An attention panel that always has three rows in it stops being read within
 * a week, and then it is worse than nothing, because it has trained the reader
 * to skip the place where real problems appear. So each entry is computed and
 * only appears when it genuinely applies, and the whole panel renders `null`
 * when there is nothing — a quiet day should look quiet.
 *
 * ## Every row is a link
 *
 * Naming a problem without offering the screen that fixes it is half a
 * feature. Each row goes to the exact view that resolves it: the filtered
 * queue, the oldest pending service, the service whose mileage looks wrong.
 */
export function AttentionPanel({ exceptions }: { exceptions: DashboardException[] }) {
  if (exceptions.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
        <AlertTriangle aria-hidden className="text-pending size-3.5" />
        {UI.admin.attentionRequired}
      </h2>

      <ul className="bg-card animate-rise divide-y overflow-hidden rounded-xl border shadow-xs">
        {exceptions.map((exception) => (
          <li key={exceptionKey(exception)}>
            <ExceptionRow exception={exception} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExceptionRow({ exception }: { exception: DashboardException }) {
  const { href, icon: Icon, title, detail } = describe(exception);

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 group flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <span
        aria-hidden
        className="bg-pending-surface text-pending flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{detail}</span>
      </span>

      <ChevronRight
        aria-hidden
        className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
      />
    </Link>
  );
}

/** The link, icon and wording for one exception. */
function describe(exception: DashboardException): {
  href: string;
  icon: typeof ClipboardCheck;
  title: string;
  detail: string;
} {
  switch (exception.kind) {
    case 'pendingApproval':
      return {
        href: '/admin/services?status=PENDING_APPROVAL',
        icon: ClipboardCheck,
        title: UI.admin.exceptionPendingTitle(exception.count),
        detail: UI.admin.exceptionPendingDetail,
      };

    case 'waitingTooLong':
      return {
        href: '/admin/services?status=PENDING_APPROVAL',
        icon: Clock,
        title: UI.admin.exceptionStaleTitle(exception.days),
        detail: UI.admin.exceptionStaleDetail(formatBusinessDate(exception.oldestDate)),
      };

    case 'unusualDistance':
      return {
        href: `/admin/services/${exception.serviceId}`,
        icon: Gauge,
        title: UI.admin.exceptionDistanceTitle(exception.serviceCode),
        detail: UI.admin.exceptionDistanceDetail(
          exception.routeCode,
          exception.actualKm,
          exception.baselineKm,
        ),
      };
  }
}

function exceptionKey(exception: DashboardException): string {
  return exception.kind === 'unusualDistance'
    ? `${exception.kind}-${exception.serviceId}`
    : exception.kind;
}
