/**
 * All services, with filters (SRS 16.3, 17.3 `/admin/services`).
 *
 * "Required controls: filters for date, Driver, Vehicle, Route/Contract,
 * status; open service detail."
 *
 * The filter options are loaded here rather than in the client component, so
 * the pickers only ever offer values that exist — and the query itself is
 * parsed with `serviceFilterSchema`, the same schema `/api/services` uses.
 */
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { AdminServiceList } from '@/components/admin/service-list';
import { ServiceFilters } from '@/components/admin/service-filters';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { routeRepository } from '@/modules/routes/repository/route.repository';
import { Role } from '@/modules/services/domain/service-status';
import { serviceFilterSchema } from '@/modules/services/schemas/service.schema';
import { toServiceListItem } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.servicesTitle };

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;

  const parsed = serviceFilterSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 25 };

  const [result, drivers, vehicles, routes] = await Promise.all([
    serviceService.list(actor, filters),
    // Inactive users, vehicles and routes stay in the pickers: a filter is a
    // historical query, and a deactivated vehicle still has services against
    // it (SRS 13.4).
    userRepository.list({ role: Role.DRIVER }),
    vehicleRepository.list({}),
    routeRepository.list({}),
  ]);

  const { items, total, pagination } = result;
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));

  return (
    <div className="space-y-5">
      <PageHeader title={UI.admin.servicesTitle} description={UI.driver.serviceCount(total)} />

      <ServiceFilters
        drivers={drivers.map((driver) => ({ id: driver.id, label: driver.name }))}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          label: vehicle.registrationPlate,
        }))}
        routes={routes.map((route) => ({
          id: route.id,
          label: `${route.code} — ${route.name}`,
        }))}
      />

      <AdminServiceList
        services={items.map(toServiceListItem)}
        empty={
          <EmptyState
            icon={ClipboardList}
            title={UI.driver.noServices}
            description={UI.admin.noServicesMatch}
          />
        }
      />

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label={UI.common.pagination}
        >
          <PageLink params={params} page={pagination.page - 1} disabled={pagination.page <= 1}>
            {UI.common.previous}
          </PageLink>
          <span className="text-muted-foreground text-sm">
            {UI.common.pageOf(pagination.page, totalPages)}
          </span>
          <PageLink
            params={params}
            page={pagination.page + 1}
            disabled={pagination.page >= totalPages}
          >
            {UI.common.next}
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

/** Preserves every active filter while changing only the page. */
function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
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

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'page' && typeof value === 'string' && value) query.set(key, value);
  }
  query.set('page', String(page));

  return (
    <Link href={`/admin/services?${query}`} className={className}>
      {children}
    </Link>
  );
}
