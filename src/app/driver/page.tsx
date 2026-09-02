/**
 * Driver dashboard (SRS 15).
 *
 * Phase 2 scope: proves the authenticated, role-scoped read path works
 * end to end. The mobile-first interface SRS 15.2 describes - the prominent
 * Add Service action, the status lists, the history link - is Phase 3.
 *
 * `requireDriver` rather than a page-level role check: the middleware already
 * routed the request here, and this call re-verifies against the database
 * (SRS 8.3), so a deactivated driver holding a valid token still cannot read.
 */
import { requireDriver } from '@/lib/auth/session';
import { SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';

export const metadata = { title: 'Panel del conductor' };

export default async function DriverDashboard() {
  const actor = await requireDriver();

  const [pending, approved] = await Promise.all([
    serviceRepository.countByStatus(actor, ServiceStatus.PENDING_APPROVAL),
    serviceRepository.countByStatus(actor, ServiceStatus.APPROVED),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Panel del conductor</h1>
        <p className="text-sm text-neutral-600">{actor.name}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 p-4">
          <dt className="text-sm text-neutral-600">{SERVICE_STATUS_LABELS.PENDING_APPROVAL}</dt>
          <dd className="text-3xl font-semibold">{pending}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <dt className="text-sm text-neutral-600">{SERVICE_STATUS_LABELS.APPROVED}</dt>
          <dd className="text-3xl font-semibold">{approved}</dd>
        </div>
      </dl>

      <p className="text-sm text-neutral-500">Interfaz completa en la fase 3.</p>
    </main>
  );
}
