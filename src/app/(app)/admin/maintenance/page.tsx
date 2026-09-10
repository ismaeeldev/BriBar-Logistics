/**
 * Maintenance list (ERP roadmap Phase 5, `/admin/maintenance`).
 *
 * Admin-only. Leads with the due-soon summary (`08_Mantenimiento`'s
 * URGENTE/PRÓXIMO/OK alert bands, via `maintenanceRecordService.dueSummary`)
 * before the ordinary newest-first, paginated history — the alert is the
 * reason an administrator opens this screen day to day; the full log is what
 * they scroll to only when they need it.
 */
import { AlertTriangle, ChevronRight, Plus, Wrench } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import type { MaintenanceUrgency } from '@/modules/maintenance/domain/maintenance-urgency';
import { maintenanceRecordService } from '@/modules/maintenance/service/maintenance-record.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.maintenance.title };

const URGENCY_TONE: Record<MaintenanceUrgency, 'destructive' | 'pending' | 'active' | 'neutral'> = {
  URGENT: 'destructive',
  UPCOMING: 'pending',
  OK: 'active',
  UNKNOWN: 'neutral',
};

function UrgencyBadge({ urgency }: { urgency: MaintenanceUrgency }) {
  return <Badge tone={URGENCY_TONE[urgency]}>{UI.admin.maintenance.urgency[urgency]}</Badge>;
}

export default async function AdminMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);

  const [due, { items: records, total }] = await Promise.all([
    maintenanceRecordService.dueSummary(actor),
    maintenanceRecordService.listPage(actor, {}, pagination),
  ]);

  const dueSoon = due.filter((record) => record.urgency === 'URGENT' || record.urgency === 'UPCOMING');

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.maintenance.title}
        section={UI.nav.sectionFleet}
        description={UI.common.total(total)}
        action={
          <Link href="/admin/maintenance/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.maintenance.created} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.maintenance.deleted} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <AlertTriangle className="size-5 text-amber-600" />
            {UI.admin.maintenance.dueSummaryTitle}
          </CardTitle>
          <p className="text-muted-foreground text-xs">{UI.admin.maintenance.dueSummaryHint}</p>
        </CardHeader>
        <CardBody>
          {dueSoon.length === 0 ? (
            <p className="text-muted-foreground text-sm">{UI.admin.maintenance.noDue}</p>
          ) : (
            <ul className="divide-border -my-2 divide-y">
              {dueSoon.map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/maintenance/${record.id}`}
                      className="text-foreground hover:underline text-sm font-medium"
                    >
                      {record.vehicle.registrationPlate}
                      <span className="text-muted-foreground font-normal"> · {record.maintenanceType.name}</span>
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {record.nextDueKm !== null ? `${record.nextDueKm} km` : null}
                      {record.nextDueKm !== null && record.nextDueDate !== null ? ' · ' : null}
                      {record.nextDueDate !== null
                        ? formatBusinessDateValue(record.nextDueDate)
                        : null}
                    </p>
                  </div>
                  <UrgencyBadge urgency={record.urgency} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="pt-2">
        <ResponsiveList
          items={records}
          getKey={(record) => record.id}
          empty={
            <EmptyState
              icon={Wrench}
              title={UI.admin.maintenance.noRecords}
              description={UI.admin.maintenance.noRecordsHint}
            />
          }
          head={
            <tr>
              <Th>{FIELD_LABELS.maintenanceCode}</Th>
              <Th>{FIELD_LABELS.vehicle}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.maintenanceType}</Th>
              <Th>{FIELD_LABELS.performedDate}</Th>
              <Th />
            </tr>
          }
          row={(record) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-600/10 text-orange-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Wrench className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-bold font-mono text-foreground">
                    #{record.maintenanceCode}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground uppercase">
                  {record.vehicle.registrationPlate}
                </span>
              </Td>
              <Td className="hidden align-middle py-3 lg:table-cell whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {record.maintenanceType.name}
                </span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {formatBusinessDateValue(record.performedDate)}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/maintenance/${record.id}`}
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
          card={(record) => (
            <Link
              href={`/admin/maintenance/${record.id}`}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-mono font-semibold text-sm truncate">
                      #{record.maintenanceCode}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {record.vehicle.registrationPlate}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Wrench className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {record.maintenanceType.name} ·{' '}
                      {formatBusinessDateValue(record.performedDate)}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  aria-hidden
                  className="text-muted-foreground size-4 shrink-0 group-hover:text-foreground transition-colors"
                />
              </div>
            </Link>
          )}
        />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/admin/maintenance"
        params={params}
      />
    </div>
  );
}
