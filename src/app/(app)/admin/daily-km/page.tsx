/**
 * Daily km log list (ERP roadmap Phase 5, `/admin/daily-km`).
 *
 * Admin-only. Same shape as `/admin/refuellings`: no active/inactive filter,
 * just newest-first with pagination.
 */
import { ChevronRight, Gauge, Plus } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { Role } from '@/modules/services/domain/service-status';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

function calculateMinutes(departure: Date, arrival: Date, endsNextDay: boolean): number {
  let diff = arrival.getTime() - departure.getTime();
  if (endsNextDay || diff < 0) diff += 24 * 60 * 60 * 1000;
  return Math.round(diff / 60000);
}

export const metadata = { title: UI.admin.dailyKm.title };

export default async function AdminDailyKmLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: manualLogs, total: manualTotal } = await dailyKmLogService.listPage(actor, {}, pagination);
  const { items: services } = await serviceRepository.list(
    {}, 
    { role: Role.ADMIN, userId: actor.userId }, 
    { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }
  );

  const unifiedLogs = [
    ...manualLogs.map(log => ({
      id: log.id,
      type: 'MANUAL' as const,
      vehicle: log.vehicle,
      route: log.route,
      driver: log.driver,
      date: log.date,
      actualKm: log.actualKm,
      workedMinutes: log.workedMinutes,
      href: `/admin/daily-km/${log.id}`
    })),
    ...services.map(service => ({
      id: service.id,
      type: 'SERVICE' as const,
      vehicle: service.vehicle,
      route: service.route,
      driver: service.driver,
      date: service.serviceDate,
      actualKm: service.actualKm,
      workedMinutes: calculateMinutes(service.departureTime, service.arrivalTime, service.endsNextDay),
      href: `/admin/services/${service.id}`
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.dailyKm.title}
        section={UI.nav.sectionFleet}
        description={UI.common.total(manualTotal + services.length)}
        action={
          <Link href="/admin/daily-km/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.dailyKm.created} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.dailyKm.deleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={unifiedLogs}
          getKey={(log) => log.id}
          empty={
            <EmptyState
              icon={Gauge}
              title={UI.admin.dailyKm.noLogs}
              description={UI.admin.dailyKm.noLogsHint}
            />
          }
          head={
            <tr>
              <Th>{FIELD_LABELS.vehicle}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.route}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.driver}</Th>
              <Th>{FIELD_LABELS.date}</Th>
              <Th>{FIELD_LABELS.actualKm}</Th>
              <Th>Horas (min)</Th>
              <Th />
            </tr>
          }
          row={(log) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-sky-600/10 text-sky-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Gauge className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground uppercase">
                    {log.vehicle.registrationPlate} {log.type === 'SERVICE' ? '(Servicio)' : '(Manual)'}
                  </span>
                </div>
              </Td>
              <Td className="hidden align-middle py-3 lg:table-cell whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {log.route ? `${log.route.code} — ${log.route.name}` : '—'}
                </span>
              </Td>
              <Td className="hidden align-middle py-3 lg:table-cell whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {log.driver ? log.driver.name : '—'}
                </span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {formatBusinessDateValue(log.date)}
                </span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground">{log.actualKm} km</span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">{log.workedMinutes ? `${log.workedMinutes} min` : '—'}</span>
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={log.href}
                    aria-label={UI.common.edit}
                    title={UI.common.edit}
                    className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-full transition-all hover:bg-muted"
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </Td>
            </>
          )}
          card={(log) => (
            <Link
              href={log.href}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-semibold text-sm truncate uppercase">
                      {log.vehicle.registrationPlate} {log.type === 'SERVICE' ? '(Servicio)' : '(Manual)'}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Gauge className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {formatBusinessDateValue(log.date)}
                      {log.driver ? ` · ${log.driver.name}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{log.actualKm} km</span>
                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4 group-hover:text-foreground transition-colors"
                  />
                </div>
              </div>
            </Link>
          )}
        />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={manualTotal + services.length}
        basePath="/admin/daily-km"
        params={params}
      />
    </div>
  );
}
