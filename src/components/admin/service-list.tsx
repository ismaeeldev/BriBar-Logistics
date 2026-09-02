import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { CardField, ResponsiveList } from '@/components/ui/responsive-list';
import { ServiceStatusBadge } from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDate } from '@/lib/time/business-date';
import type { ServiceListItem } from '@/modules/services/service/service.presenter';

/**
 * The administrator's service list (SRS 16.3).
 *
 * On a desktop this is a table: eight aligned columns an administrator scans
 * down while working through a queue. On a phone the same eight columns become
 * a card per service, because a table that wide can only scroll sideways — and
 * the approval queue is exactly the screen someone checks from a phone.
 */
export function AdminServiceList({
  services,
  empty,
}: {
  services: ServiceListItem[];
  empty?: React.ReactNode;
}) {
  return (
    <ResponsiveList
      items={services}
      getKey={(service) => service.id}
      {...(empty ? { empty } : {})}
      head={
        <tr>
          <Th>{FIELD_LABELS.serviceDate}</Th>
          <Th>{FIELD_LABELS.serviceCode}</Th>
          <Th>{FIELD_LABELS.driver}</Th>
          <Th>{UI.admin.routeColumn}</Th>
          <Th className="hidden xl:table-cell">{FIELD_LABELS.vehicle}</Th>
          <Th className="text-right">{FIELD_LABELS.actualKm}</Th>
          <Th className="text-right">{FIELD_LABELS.serviceKm}</Th>
          <Th />
        </tr>
      }
      row={(service) => (
        <>
          <Td className="whitespace-nowrap">{formatBusinessDate(service.serviceDate)}</Td>
          <Td className="text-muted-foreground font-mono">#{service.serviceCode}</Td>
          <Td className="whitespace-nowrap">{service.driver.name}</Td>
          <Td className="max-w-48 truncate">
            <span className="font-medium">{service.route.code}</span>
            <span className="text-muted-foreground"> · {service.route.name}</span>
          </Td>
          {/* The plate is the first thing to go when the window narrows: it is
              on the detail page, and the route is what identifies the work. */}
          <Td className="hidden font-mono whitespace-nowrap xl:table-cell">
            {service.vehicle.registrationPlate}
          </Td>
          <Td className="text-right font-mono">{service.actualKm}</Td>
          <Td className="text-right font-mono">{service.serviceKm}</Td>
          <Td className="text-right">
            <div className="flex items-center justify-end gap-2">
              <ServiceStatusBadge status={service.status} />
              <Link
                href={`/admin/services/${service.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors"
              >
                {UI.admin.review}
                <ChevronRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </Td>
        </>
      )}
      card={(service) => (
        <Link
          href={`/admin/services/${service.id}`}
          className="hover:bg-muted/50 block px-4 py-3.5 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-sm font-semibold">
                {formatBusinessDate(service.serviceDate)}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                #{service.serviceCode}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ServiceStatusBadge status={service.status} />
              <ChevronRight aria-hidden className="text-muted-foreground size-4" />
            </div>
          </div>

          <p className="mt-1.5 truncate text-sm">
            <span className="font-medium">{service.route.code}</span>
            <span className="text-muted-foreground"> · {service.route.name}</span>
          </p>

          <dl className="mt-2 grid grid-cols-3 gap-3">
            <CardField label={FIELD_LABELS.driver}>{service.driver.name}</CardField>
            <CardField label={FIELD_LABELS.actualKm} mono>
              {service.actualKm}
            </CardField>
            <CardField label={FIELD_LABELS.serviceKm} mono>
              {service.serviceKm}
            </CardField>
          </dl>
        </Link>
      )}
    />
  );
}
