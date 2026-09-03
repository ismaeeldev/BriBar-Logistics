import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { StatusDot, StatusLegend } from '@/components/ui/primitives';
import { CardField } from '@/components/ui/responsive-list';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { env } from '@/lib/env';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import {
  currentBusinessDate,
  formatBusinessDate,
  relativeBusinessDate,
  toIsoDate,
} from '@/lib/time/business-date';
import { cn } from '@/lib/utils/cn';
import type { ServiceListItem } from '@/modules/services/service/service.presenter';

/**
 * The administrator's service list (SRS 16.3).
 *
 * ## Dates are a heading, not a column
 *
 * Services arrive in date order and several land on the same day, so a Date
 * column repeated the same value down four or five consecutive rows — the
 * widest column in the table spent saying "still the second of September". The
 * date is now a heading over the run of services that share it, the way a
 * message list separates one day from the next, and the two most recent days
 * are named rather than numbered.
 *
 * That buys back a column, which is what lets the plate stay visible from `lg`
 * instead of only at `xl`.
 *
 * ## Two shapes, chosen by CSS
 *
 * On a desktop this is a table: aligned columns an administrator scans down
 * while working through a queue. On a phone each service is a card, because a
 * table this wide can only scroll sideways — and the approval queue is exactly
 * the screen someone checks from a phone. Both are in the markup, so nothing
 * flashes on load and no JavaScript is involved in the choice.
 */
export function AdminServiceList({
  services,
  empty,
}: {
  services: ServiceListItem[];
  empty?: React.ReactNode;
}) {
  if (services.length === 0) {
    return empty ? <div className="bg-card rounded-xl border shadow-xs">{empty}</div> : null;
  }

  // One "today" for the whole list. Reading the clock per row could straddle
  // midnight and label two adjacent rows inconsistently.
  const todayIso = toIsoDate(currentBusinessDate(env.APP_TIMEZONE));
  const groups = groupByDate(services);

  return (
    <div className="space-y-3">
      <StatusLegend className="px-1" />

      {/* Mobile: a heading, then that day's cards. */}
      <div className="space-y-4 md:hidden">
        {groups.map((group) => (
          <section key={group.date}>
            <GroupHeading
              date={group.date}
              todayIso={todayIso}
              count={group.items.length}
              className="px-1 pb-1.5"
            />
            <ul className="bg-card animate-rise divide-y overflow-hidden rounded-xl border shadow-xs">
              {group.items.map((service) => (
                <li key={service.id}>
                  <ServiceCardRow service={service} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Desktop: one table, with a row group per day. */}
      <TableWrap className="hidden md:block">
        <Table>
          <Thead>
            <tr>
              <Th>{FIELD_LABELS.serviceCode}</Th>
              <Th>{FIELD_LABELS.driver}</Th>
              <Th>{UI.admin.routeColumn}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.vehicle}</Th>
              <Th className="text-right">{FIELD_LABELS.actualKm}</Th>
              <Th className="text-right">{FIELD_LABELS.serviceKm}</Th>
              <Th className="w-px" />
            </tr>
          </Thead>

          {groups.map((group) => (
            <Tbody key={group.date}>
              {/* `scope="colgroup"` is what makes this a heading for the rows
                  beneath it, rather than a stray cell a screen reader reads
                  out in the middle of the data. */}
              <tr className="bg-muted/50">
                <th
                  scope="colgroup"
                  colSpan={7}
                  className="text-muted-foreground border-y px-3 py-1.5 text-left text-xs font-medium"
                >
                  <GroupHeading
                    date={group.date}
                    todayIso={todayIso}
                    count={group.items.length}
                  />
                </th>
              </tr>

              {group.items.map((service) => (
                <Tr key={service.id}>
                  <Td className="text-muted-foreground font-mono whitespace-nowrap">
                    #{service.serviceCode}
                  </Td>
                  <Td className="whitespace-nowrap">{service.driver.name}</Td>
                  <Td className="max-w-56 truncate">
                    <span className="font-medium">{service.route.code}</span>
                    <span className="text-muted-foreground"> · {service.route.name}</span>
                  </Td>
                  {/* The plate is the first thing to go when the window
                      narrows: it is on the detail page, and the route is what
                      identifies the work. */}
                  <Td className="hidden font-mono whitespace-nowrap lg:table-cell">
                    {service.vehicle.registrationPlate}
                  </Td>
                  <Td className="text-right font-mono">{service.actualKm}</Td>
                  <Td className="text-right font-mono">{service.serviceKm}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2.5">
                      <StatusDot status={service.status} />
                      <Link
                        href={`/admin/services/${service.id}`}
                        aria-label={UI.admin.review}
                        title={UI.admin.review}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-7 items-center justify-center rounded-md transition-colors"
                      >
                        <ChevronRight aria-hidden className="size-4" />
                      </Link>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          ))}
        </Table>
      </TableWrap>
    </div>
  );
}

function GroupHeading({
  date,
  todayIso,
  count,
  className,
}: {
  date: string;
  todayIso: string;
  count: number;
  className?: string;
}) {
  const relative = relativeBusinessDate(date, todayIso);
  const label =
    relative === 'today'
      ? UI.common.today
      : relative === 'yesterday'
        ? UI.common.yesterday
        : formatBusinessDate(date);

  return (
    <span className={cn('flex items-baseline gap-2', className)}>
      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      {/* A named day loses its number entirely otherwise, and "which date was
          that" is a question an administrator does ask. */}
      {relative ? (
        <span className="text-muted-foreground font-mono text-[0.7rem]">
          {formatBusinessDate(date)}
        </span>
      ) : null}
      <span className="text-muted-foreground ml-auto text-[0.7rem] font-normal tabular-nums">
        {UI.common.servicesShort(count)}
      </span>
    </span>
  );
}

function ServiceCardRow({ service }: { service: ServiceListItem }) {
  return (
    <Link
      href={`/admin/services/${service.id}`}
      className="hover:bg-muted/50 block px-4 py-3.5 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm">
          <span className="font-medium">{service.route.code}</span>
          <span className="text-muted-foreground"> · {service.route.name}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <StatusDot status={service.status} />
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-4 gap-3">
        <CardField label={FIELD_LABELS.serviceCode} mono>
          #{service.serviceCode}
        </CardField>
        <CardField label={FIELD_LABELS.driver}>{service.driver.name}</CardField>
        <CardField label={FIELD_LABELS.actualKm} mono>
          {service.actualKm}
        </CardField>
        <CardField label={FIELD_LABELS.serviceKm} mono>
          {service.serviceKm}
        </CardField>
      </dl>
    </Link>
  );
}

/**
 * Consecutive runs of the same service date, in the order they arrived.
 *
 * Runs rather than buckets: the list is already sorted by date, so grouping
 * adjacent equal values preserves whatever ordering the query chose. Collecting
 * into a map and re-sorting would quietly impose a second opinion about order,
 * and would get it wrong the moment a filter sorts by something else.
 */
function groupByDate(
  services: ServiceListItem[],
): { date: string; items: ServiceListItem[] }[] {
  const groups: { date: string; items: ServiceListItem[] }[] = [];

  for (const service of services) {
    const current = groups[groups.length - 1];
    if (current && current.date === service.serviceDate) current.items.push(service);
    else groups.push({ date: service.serviceDate, items: [service] });
  }

  return groups;
}
