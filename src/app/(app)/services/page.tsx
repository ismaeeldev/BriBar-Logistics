/**
 * Service history (SRS 17.2 `/services`).
 *
 * "Current Driver's service history. DRIVER sees only own services."
 *
 * The scoping is not done here. `serviceService.list` pushes the driver's own
 * id into the SQL `where` for any non-admin, so this page could not show
 * someone else's services even if it tried (SRS 9.7).
 */
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { ServiceCard } from '@/components/services/service-card';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceFilterSchema } from '@/modules/services/schemas/service.schema';
import { toServiceListItem } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: 'Historial de servicios' };

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: ServiceStatus.PENDING_APPROVAL, label: SERVICE_STATUS_LABELS.PENDING_APPROVAL },
  { value: ServiceStatus.APPROVED, label: SERVICE_STATUS_LABELS.APPROVED },
] as const;

export default async function ServiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;

  // Parsed through the same schema the API uses, so a hand-edited query string
  // is validated identically whichever door it comes through.
  const parsed = serviceFilterSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 25 };

  const { items, total, pagination } = await serviceService.list(actor, filters);
  const activeStatus = typeof params['status'] === 'string' ? params['status'] : '';
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Historial"
        description={`${total} ${total === 1 ? 'servicio' : 'servicios'}`}
      />

      {/* Status filter. Links rather than a client-side control: the state
          lives in the URL, so a filtered view is shareable and survives a
          back-navigation. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const isActive = activeStatus === filter.value;
          return (
            <Link
              key={filter.value || 'all'}
              href={filter.value ? `/services?status=${filter.value}` : '/services'}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:bg-muted',
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No hay servicios"
            description={
              activeStatus
                ? 'Pruebe con otro filtro.'
                : 'Los servicios que registre aparecerán aquí.'
            }
          />
        ) : (
          <div>
            {items.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación">
          <PageLink
            page={pagination.page - 1}
            status={activeStatus}
            disabled={pagination.page <= 1}
          >
            Anterior
          </PageLink>
          <span className="text-muted-foreground text-sm">
            Página {pagination.page} de {totalPages}
          </span>
          <PageLink
            page={pagination.page + 1}
            status={activeStatus}
            disabled={pagination.page >= totalPages}
          >
            Siguiente
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  page,
  status,
  disabled,
  children,
}: {
  page: number;
  status: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className =
    'rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors bg-card hover:bg-muted';

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, 'pointer-events-none opacity-40')}>
        {children}
      </span>
    );
  }

  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);

  return (
    <Link href={`/services?${query.toString()}`} className={className}>
      {children}
    </Link>
  );
}
