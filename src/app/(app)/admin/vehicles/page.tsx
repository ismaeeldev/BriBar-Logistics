/**
 * Vehicle master list (SRS 13.2, 17.3 `/admin/vehicles`).
 *
 * "Admin shall be able to view active and inactive vehicles." Both, in one
 * list by default, with inactive ones sorted last and visibly marked. The
 * status filter is an opt-in narrowing only - nothing is hidden unless the
 * administrator asks for it, so a deactivated vehicle never silently looks
 * deleted (SRS 21.5).
 */
import { ChevronRight, Plus, Truck, Users, ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar, ListFilters } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th, SortableTh } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.vehiclesTitle };

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  // One query string carries both the success flags and the page number: a
  // redirect after a save lands on `?created=1`, which is page 1 by default.
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: vehicles, total } = await vehicleService.listPage(
    actor,
    {
      ...(pagination.q ? { q: pagination.q } : {}),
      ...(pagination.isActive !== undefined ? { isActive: pagination.isActive } : {}),
    },
    pagination,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.vehiclesTitle}
        section={UI.nav.sectionMasterData}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchVehicles} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link href="/admin/vehicles/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.vehicleCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.vehicleUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.vehicleDeleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={vehicles}
        getKey={(vehicle) => vehicle.id}
        empty={
          <EmptyState
            icon={Truck}
            title={UI.admin.noVehicles}
            description={UI.admin.noVehiclesHint}
          />
        }
        head={
          <tr>
            <SortableTh sortKey="registrationPlate" className="w-72">{FIELD_LABELS.registrationPlate}</SortableTh>
            <SortableTh sortKey="referenceName">{FIELD_LABELS.name}</SortableTh>
            <Th className="hidden lg:table-cell">{UI.admin.assignedDriversColumn}</Th>
            <Th className="hidden lg:table-cell">{UI.admin.totalServicesColumn}</Th>
            <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
            <Th />
          </tr>
        }
        row={(vehicle) => (
          <>
            <Td className="align-middle py-3.5 whitespace-nowrap w-72">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/10 text-blue-500 flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Truck className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-[14px] font-bold text-foreground leading-tight uppercase tracking-wide">
                    {vehicle.registrationPlate}
                  </span>
                  {vehicle.referenceName ? (
                    <span className="text-[12px] text-muted-foreground leading-none">
                      {vehicle.referenceName}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50 leading-none italic">
                      {UI.admin.noReference}
                    </span>
                  )}
                </div>
              </div>
            </Td>
            <Td className="align-middle py-3.5">
              {vehicle.referenceName ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-foreground">{vehicle.referenceName}</span>
                  <span className="text-[11px] text-muted-foreground">{FIELD_LABELS.referenceName}</span>
                </div>
              ) : (
                <span className="text-[13px] text-muted-foreground/60 italic">—</span>
              )}
            </Td>
            <Td className="hidden align-middle py-3.5 lg:table-cell whitespace-nowrap">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Users className="size-3.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-foreground leading-none tabular-nums">
                    {vehicle._count.defaultForUsers}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {UI.admin.driverUnit(vehicle._count.defaultForUsers)}
                  </span>
                </div>
              </div>
            </Td>
            <Td className="hidden align-middle py-3.5 lg:table-cell whitespace-nowrap">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <ClipboardList className="size-3.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-foreground leading-none tabular-nums">
                    {vehicle._count.services}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {UI.admin.servicesUnit}
                  </span>
                </div>
              </div>
            </Td>
            <Td className="align-middle py-3.5">
              <StatePill isActive={vehicle.isActive} label={vehicle.isActive ? UI.common.active : UI.common.inactive} />
            </Td>
            <Td className="align-middle py-3.5">
              <div className="flex justify-end">
                <Link
                  href={`/admin/vehicles/${vehicle.id}`}
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
        card={(vehicle) => (
          <Link
            href={`/admin/vehicles/${vehicle.id}`}
            className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 min-w-0">
                  <span className="text-foreground font-semibold text-sm truncate">{vehicle.registrationPlate}</span>
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="size-3.5 shrink-0" />
                  <span className="truncate text-xs text-foreground/80">{vehicle.referenceName || UI.common.none}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge subtle tone={vehicle.isActive ? 'approved' : 'neutral'} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                  {vehicle.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                </Badge>
                <ChevronRight aria-hidden className="text-muted-foreground size-4 group-hover:text-foreground transition-colors" />
              </div>
            </div>
          </Link>
        )}
      />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/admin/vehicles"
        params={params}
      />
    </div>
  );
}
