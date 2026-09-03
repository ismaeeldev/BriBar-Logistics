import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Journey } from '@/components/ui/journey';
import { StatusPill } from '@/components/ui/primitives';
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
 * ## Not every cell is equally important
 *
 * An earlier version set every column in the same weight, which is why it read
 * as a wall rather than as a queue. The scan an administrator actually
 * performs is: which contract, run by whom, how far, and does it need me. So
 * the route code is the heaviest thing in the row with the journey under it in
 * muted type, the two mileages share one column as `actual / service`, and the
 * plate and the driver sit back in ordinary weight.
 *
 * `MAD-BCN-01 · Madrid - Barcelona diario` was also one long string. It is now
 * two lines — the code, then `Madrid → Barcelona` from the service's own
 * origin and destination snapshot, which is the journey that was actually run
 * rather than whatever the route master says today (SRS 14.5).
 *
 * ## Dates are a heading, not a column
 *
 * Services arrive in date order and several land on the same day, so a Date
 * column repeated the same value down four consecutive rows. The date is now a
 * heading over the run of services that share it, the way a message list
 * separates one day from the next, and the two most recent days are named.
 *
 * ## Two shapes, chosen by CSS
 *
 * On a desktop this is a table. On a phone each service is a card, because a
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
              <Th className="w-16">{FIELD_LABELS.serviceCode}</Th>
              <Th>{UI.admin.routeColumn}</Th>
              <Th>{FIELD_LABELS.driver}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.vehicle}</Th>
              <Th className="text-right">{UI.admin.distanceColumn}</Th>
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
                  colSpan={6}
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
                  <Td className="text-muted-foreground align-top font-mono whitespace-nowrap">
                    #{service.serviceCode}
                  </Td>

                  <Td className="max-w-64 align-top">
                    <span className="block truncate font-mono text-sm font-semibold">
                      {service.route.code}
                    </span>
                    <Journey
                      origin={service.origin}
                      destination={service.destination}
                      className="text-muted-foreground mt-0.5 text-xs"
                    />
                  </Td>

                  <Td className="align-top whitespace-nowrap">{service.driver.name}</Td>

                  {/* The plate is the first thing to go when the window
                      narrows: it is on the detail page, and the route is what
                      identifies the work. */}
                  <Td className="text-muted-foreground hidden align-top font-mono whitespace-nowrap lg:table-cell">
                    {service.vehicle.registrationPlate}
                  </Td>

                  <Td className="text-right align-top whitespace-nowrap">
                    <span className="font-mono text-sm font-medium tabular-nums">
                      {service.actualKm}
                    </span>
                    <span className="text-muted-foreground font-mono text-sm"> / </span>
                    <span className="font-mono text-sm font-medium tabular-nums">
                      {service.serviceKm}
                    </span>
                    <span className="text-muted-foreground text-xs"> km</span>
                  </Td>

                  <Td className="align-top">
                    <div className="flex items-center justify-end gap-2.5">
                      <StatusPill status={service.status} />
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
      className="hover:bg-muted/50 block px-4 py-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold">{service.route.code}</span>
            <span className="text-muted-foreground font-mono text-xs">
              #{service.serviceCode}
            </span>
          </p>
          <Journey
            origin={service.origin}
            destination={service.destination}
            className="text-muted-foreground mt-0.5 text-xs"
          />
        </div>
        <StatusPill status={service.status} />
      </div>

      <p className="text-muted-foreground mt-2 flex items-center gap-x-3 text-xs">
        <span>{service.driver.name}</span>
        <span aria-hidden className="bg-border size-0.5 rounded-full" />
        <span className="font-mono">{service.vehicle.registrationPlate}</span>
        <span className="ml-auto">
          <span className="text-foreground font-mono font-medium tabular-nums">
            {service.actualKm}
          </span>
          {' / '}
          <span className="text-foreground font-mono font-medium tabular-nums">
            {service.serviceKm}
          </span>
          {' km'}
        </span>
      </p>
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
