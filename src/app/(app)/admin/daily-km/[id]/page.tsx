/**
 * Edit a daily km log (ERP roadmap Phase 5, `/admin/daily-km/[id]`).
 *
 * Nothing references a `DailyKmLog` row, so it is always deletable — no
 * `getDeletability` call, same reasoning as the refuelling edit page.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteDailyKmLogAction, updateDailyKmLogAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { DailyKmLogForm } from '@/components/admin/daily-km-log-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { toIsoDate } from '@/lib/time/business-date';
import { routeRepository } from '@/modules/routes/repository/route.repository';
import { Role } from '@/modules/services/domain/service-status';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.dailyKm.editLog };

export default async function EditDailyKmLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let log;
  try {
    log = await dailyKmLogService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const [vehicles, routes, drivers] = await Promise.all([
    vehicleRepository.list({ isActive: true }),
    routeRepository.list({ isActive: true }),
    userRepository.list({ role: Role.DRIVER, isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/daily-km"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.dailyKm.title}
      </Link>

      <PageHeader
        title={UI.admin.dailyKm.editLog}
        section={UI.nav.sectionFleet}
        description={`${log.vehicle.registrationPlate} · ${toIsoDate(log.date)}`}
      />

      {flags.updated ? <Alert tone="success" title={UI.admin.dailyKm.updated} /> : null}

      <DailyKmLogForm
        action={updateDailyKmLogAction.bind(null, id)}
        submitLabel={UI.common.save}
        context={{ vehicles, routes, drivers }}
        initial={{
          vehicleId: log.vehicleId,
          routeId: log.routeId ?? '',
          driverId: log.driverId ?? '',
          date: toIsoDate(log.date),
          actualKm: String(log.actualKm),
          workedHours: log.workedMinutes !== null ? String(log.workedMinutes / 60) : '',
          notes: log.notes ?? '',
        }}
      />

      <DeleteRecord
        action={deleteDailyKmLogAction.bind(null, id)}
        name={`${log.vehicle.registrationPlate} · ${toIsoDate(log.date)}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />
    </div>
  );
}
