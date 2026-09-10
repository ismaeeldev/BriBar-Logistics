/**
 * Edit a maintenance record (ERP roadmap Phase 5, `/admin/maintenance/[id]`).
 *
 * Nothing references a `MaintenanceRecord` row, so it is always deletable —
 * same reasoning as the refuelling, daily-km-log and personnel-cost edit
 * pages.
 */
import { ArrowLeft, Gauge } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  deleteMaintenanceRecordAction,
  updateMaintenanceRecordAction,
} from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { MaintenanceRecordForm } from '@/components/admin/maintenance-record-form';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { formatBusinessDateValue, toIsoDate } from '@/lib/time/business-date';
import type { MaintenanceUrgency } from '@/modules/maintenance/domain/maintenance-urgency';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { maintenanceRecordService } from '@/modules/maintenance/service/maintenance-record.service';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.maintenance.editRecord };

const URGENCY_TONE: Record<MaintenanceUrgency, 'destructive' | 'pending' | 'active' | 'neutral'> = {
  URGENT: 'destructive',
  UPCOMING: 'pending',
  OK: 'active',
  UNKNOWN: 'neutral',
};

export default async function EditMaintenanceRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let record;
  try {
    record = await maintenanceRecordService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const [vehicles, maintenanceTypes] = await Promise.all([
    vehicleRepository.list({ isActive: true }),
    lookupService.list(actor, 'MAINTENANCE_TYPE', { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/maintenance"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.maintenance.title}
      </Link>

      <PageHeader
        title={UI.admin.maintenance.editRecord}
        section={UI.nav.sectionFleet}
        description={`#${record.maintenanceCode}`}
      />

      {flags.updated ? <Alert tone="success" title={UI.admin.maintenance.updated} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <Gauge className="size-5 text-orange-600" />
            {UI.admin.maintenance.dueSummaryTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1">
            <DetailRow
              label={UI.admin.maintenance.urgencyLabel}
              value={
                <Badge tone={URGENCY_TONE[record.urgency]}>
                  {UI.admin.maintenance.urgency[record.urgency]}
                </Badge>
              }
            />
            <DetailRow
              label={FIELD_LABELS.nextDueKm}
              value={record.nextDueKm !== null ? `${record.nextDueKm} km` : '—'}
            />
            <DetailRow
              label={FIELD_LABELS.nextDueDate}
              value={
                record.nextDueDate !== null ? formatBusinessDateValue(record.nextDueDate) : '—'
              }
            />
          </dl>
        </CardBody>
      </Card>

      <MaintenanceRecordForm
        action={updateMaintenanceRecordAction.bind(null, id)}
        submitLabel={UI.common.save}
        context={{ vehicles, maintenanceTypes }}
        initial={{
          vehicleId: record.vehicleId,
          maintenanceTypeId: record.maintenanceTypeId,
          performedDate: toIsoDate(record.performedDate),
          performedKm: record.performedKm !== null ? String(record.performedKm) : '',
          nextDueKm: record.nextDueKm !== null ? String(record.nextDueKm) : '',
          nextDueDate: record.nextDueDate !== null ? toIsoDate(record.nextDueDate) : '',
          notes: record.notes ?? '',
        }}
      />

      <DeleteRecord
        action={deleteMaintenanceRecordAction.bind(null, id)}
        name={`#${record.maintenanceCode}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />
    </div>
  );
}
