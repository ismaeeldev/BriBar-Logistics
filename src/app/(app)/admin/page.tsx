/**
 * Admin dashboard (SRS 16).
 *
 * Phase 2 scope, as with the driver dashboard: the approval queue and the
 * master-data navigation SRS 16.2 requires arrive in Phase 4.
 */
import { requireAdmin } from '@/lib/auth/session';
import { SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';

export const metadata = { title: 'Panel de administración' };

export default async function AdminDashboard() {
  const actor = await requireAdmin();

  const [pending, approved] = await Promise.all([
    serviceRepository.countByStatus(actor, ServiceStatus.PENDING_APPROVAL),
    serviceRepository.countByStatus(actor, ServiceStatus.APPROVED),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
        <p className="text-sm text-neutral-600">{actor.name}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 p-4">
          <dt className="text-sm text-neutral-600">{SERVICE_STATUS_LABELS.PENDING_APPROVAL}</dt>
          <dd className="text-3xl font-semibold">{pending}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <dt className="text-sm text-neutral-600">{SERVICE_STATUS_LABELS.APPROVED}</dt>
          <dd className="text-3xl font-semibold">{approved}</dd>
        </div>
      </dl>

      <p className="text-sm text-neutral-500">Interfaz completa en la fase 4.</p>
    </main>
  );
}
