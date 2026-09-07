'use client';

import { ArrowRight, ChevronRight, ChevronDown, MapPin, Phone, Truck, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { StatusPill } from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { FIELD_LABELS, UI, SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import {
  formatBusinessDate,
  relativeBusinessDate,
} from '@/lib/time/business-date';
import { cn } from '@/lib/utils/cn';
import type { ServiceListItem } from '@/modules/services/service/service.presenter';

function DistanceProgress({ actual, planned }: { actual: number; planned: number }) {
  const percentage = planned > 0 ? Math.round((actual / planned) * 100) : 0;
  
  let barColor = "bg-blue-500";
  let textColor = "text-blue-500";

  if (percentage === 100) {
    barColor = "bg-blue-500";
    textColor = "text-emerald-500";
  } else if (percentage > 100 && percentage < 150) {
    barColor = "bg-amber-500";
    textColor = "text-amber-500";
  } else if (percentage >= 150) {
    barColor = "bg-emerald-500";
    textColor = "text-emerald-500";
  } else {
    barColor = "bg-blue-500";
    textColor = "text-blue-500";
  }

  return (
    <div className="flex flex-col gap-1.5 w-32">
      <div className="text-xs font-semibold text-foreground tracking-tight">
        {actual} / {planned} km
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-muted/60 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", barColor)} 
            style={{ width: `${Math.min(percentage, 100)}%` }} 
          />
        </div>
        <span className={cn("text-[10px] font-bold tabular-nums min-w-[3ch] text-right", textColor)}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

export function AdminServiceList({
  services,
  todayIso,
  empty,
  tableClassName,
}: {
  services: ServiceListItem[];
  todayIso: string;
  empty?: React.ReactNode;
  tableClassName?: string;
}) {
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  if (services.length === 0) {
    return empty ? (
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm">{empty}</div>
    ) : null;
  }

  const groups = groupByDate(services);

  return (
    <div className="space-y-3">
      {/* Mobile: a heading, then that day's cards. */}
      <div className="space-y-4 md:hidden">
        {groups.map((group) => {
          const isCollapsed = collapsedDates.has(group.date);
          return (
            <section key={group.date}>
              <button
                type="button"
                onClick={() => toggleDate(group.date)}
                className="flex w-full items-center px-1 pb-1.5 focus:outline-none"
              >
                <GroupHeading
                  date={group.date}
                  todayIso={todayIso}
                  count={group.items.length}
                  className="flex-1 mr-4"
                />
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>
              {!isCollapsed && (
                <ul className="animate-rise space-y-3">
                  {group.items.map((service) => (
                    <li
                      key={service.id}
                      className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm transition-shadow duration-300 hover:shadow-md"
                    >
                      <ServiceCardRow service={service} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>


      {/* Desktop: one table, with a row group per day. */}
      <TableWrap className={cn("hidden md:block", tableClassName)}>
        <Table>
          <Thead>
            <tr>
              <Th className="w-16">{FIELD_LABELS.serviceCode}</Th>
              <Th>{UI.admin.routeColumn}</Th>
              <Th>{FIELD_LABELS.driver}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.vehicle}</Th>
              <Th>{UI.admin.distanceColumn}</Th>
              <Th>{UI.common.status}</Th>
              <Th className="w-px" />
            </tr>
          </Thead>

          {groups.map((group) => {
            const isCollapsed = collapsedDates.has(group.date);
            return (
              <Tbody key={group.date}>
                <tr 
                  className="bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer border-y border-border/50"
                  onClick={() => toggleDate(group.date)}
                >
                  <th
                    scope="colgroup"
                    colSpan={6}
                    className="text-muted-foreground px-4 py-2 text-left text-xs font-medium"
                  >
                    <div className="flex items-center w-full">
                      <GroupHeading
                        date={group.date}
                        todayIso={todayIso}
                        count={group.items.length}
                        className="flex-1 mr-4"
                      />
                      <ChevronDown
                        className={cn(
                          'size-4 transition-transform duration-200',
                          isCollapsed && '-rotate-90'
                        )}
                      />
                    </div>
                  </th>
                </tr>

                {!isCollapsed &&
                  group.items.map((service) => (
                    <Tr key={service.id} className="group hover:bg-muted/10 transition-colors">
                      <Td className="align-middle py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[14px] font-bold text-foreground leading-none">
                            {service.serviceCode}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="size-3 opacity-70" />
                            {formatBusinessDate(service.serviceDate)}
                          </span>
                        </div>
                      </Td>

                      <Td className="max-w-48 align-middle py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[14px] font-bold text-foreground leading-none truncate" title={service.route.code}>
                            {service.route.code}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate" title={`${service.origin} → ${service.destination}`}>
                            <MapPin className="size-3 text-blue-500 shrink-0" />
                            <span className="truncate max-w-[4.5rem]">{service.origin.length > 10 ? service.origin.slice(0, 10) + '…' : service.origin}</span>
                            <span className="opacity-40 shrink-0">›</span>
                            <span className="truncate max-w-[4.5rem]">{service.destination.length > 10 ? service.destination.slice(0, 10) + '…' : service.destination}</span>
                          </span>
                        </div>
                      </Td>

                      <Td className="align-middle py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[14px] font-bold text-foreground leading-none">{service.driver.name}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Phone className="size-3 opacity-70 shrink-0" />
                            +34 600 123 456
                          </span>
                        </div>
                      </Td>

                      <Td className="hidden align-middle lg:table-cell py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-600/10 text-blue-500 flex size-7 shrink-0 items-center justify-center rounded-lg">
                            <Truck className="size-3.5" />
                          </div>
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="text-[14px] font-bold text-foreground leading-none uppercase tracking-wide">
                              {service.vehicle.registrationPlate}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground leading-none">
                              Matrícula
                            </span>
                          </div>
                        </div>
                      </Td>

                      <Td className="align-middle py-3">
                        <DistanceProgress actual={service.actualKm} planned={service.serviceKm} />
                      </Td>

                      <Td className="align-middle py-3 whitespace-nowrap">
                        <StatusPill status={service.status} />
                      </Td>

                      <Td className="align-middle py-3">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/admin/services/${service.id}`}
                            aria-label={UI.admin.review}
                            title={UI.admin.review}
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-full transition-all hover:bg-muted"
                          >
                            <ChevronRight aria-hidden className="size-4" />
                          </Link>
                        </div>
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            );
          })}
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
    <span className={cn('flex items-center justify-between', className)}>
      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span className="flex items-baseline gap-2 mr-2">
        <span className="bg-muted text-muted-foreground text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full">
          {UI.common.servicesShort(count)}
        </span>
      </span>
    </span>
  );
}

function ServiceCardRow({ service }: { service: ServiceListItem }) {
  return (
    <Link
      href={`/admin/services/${service.id}`}
      className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 min-w-0">
            <span className="text-foreground font-semibold text-sm truncate flex items-center gap-1.5" title={service.route.code}>
              <MapPin className="size-3.5 text-blue-500 shrink-0" />
              {service.route.code.length > 10 ? service.route.code.slice(0, 10) + '…' : service.route.code}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono font-medium text-muted-foreground border border-border/50">
              #{service.serviceCode}
            </span>
          </p>
          <div className="mt-1.5 flex flex-col gap-1 text-muted-foreground">
            <span className="truncate text-[11px] flex items-center gap-1" title={`${service.origin} → ${service.destination}`}>
              {service.origin.length > 12 ? service.origin.slice(0, 12) + '…' : service.origin} 
              <ArrowRight className="size-3 opacity-50 shrink-0 mx-0.5" /> 
              {service.destination.length > 12 ? service.destination.slice(0, 12) + '…' : service.destination}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div 
            className="relative flex size-2.5 items-center justify-center mt-1 mr-1"
            title={SERVICE_STATUS_LABELS[service.status]}
          >
            {service.status === 'PENDING_APPROVAL' ? (
              <>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-orange-500"></span>
              </>
            ) : (
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-secondary text-secondary-foreground border border-border/60 shadow-sm uppercase tracking-wider">
              {service.vehicle.registrationPlate}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-4 items-end">
        <div className="flex items-center gap-2">
          <p className="text-sm text-foreground font-bold truncate">
            {service.driver.name}
          </p>
        </div>
        <div className="flex justify-end">
          <DistanceProgress actual={service.actualKm} planned={service.serviceKm} />
        </div>
      </div>
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
