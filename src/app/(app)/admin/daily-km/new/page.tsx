/** Record a daily km log (ERP roadmap Phase 5, `/admin/daily-km/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createDailyKmLogAction } from '@/app/(app)/admin/actions';
import { DailyKmLogForm } from '@/components/admin/daily-km-log-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { routeRepository } from '@/modules/routes/repository/route.repository';
import { Role } from '@/modules/services/domain/service-status';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.dailyKm.newLog };

export default async function NewDailyKmLogPage() {
  await requireAdmin();

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

      <PageHeader title={UI.admin.dailyKm.newLog} section={UI.nav.sectionFleet} />

      <DailyKmLogForm
        action={createDailyKmLogAction}
        submitLabel={UI.common.create}
        context={{ vehicles, routes, drivers }}
      />
    </div>
  );
}
