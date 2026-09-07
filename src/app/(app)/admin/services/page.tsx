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

import { AdminServiceList } from '@/components/admin/service-list';
import { ServiceFilters } from '@/components/admin/service-filters';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { SearchBar } from '@/components/ui/search-bar';
import { requireAdmin } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { UI } from '@/lib/i18n/messages';
import { currentBusinessDate, toIsoDate } from '@/lib/time/business-date';
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

  const todayIso = toIsoDate(currentBusinessDate(env.APP_TIMEZONE));
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

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.serviceManagement}
        section={UI.nav.sectionOperations}
        description={UI.driver.serviceCount(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchServices} className="w-full" />}
        filters={
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
        }
      />

      <div className="pt-2">
        <AdminServiceList
          services={items.map(toServiceListItem)}
        todayIso={todayIso}
        empty={
          <EmptyState
            icon={ClipboardList}
            title={UI.driver.noServices}
            description={UI.admin.noServicesMatch}
          />
        }
      />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/admin/services"
        params={params}
      />
    </div>
  );
}
