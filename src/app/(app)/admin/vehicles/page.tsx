/**
 * Vehicle master list (SRS 13.2, 17.3 `/admin/vehicles`).
 *
 * "Admin shall be able to view active and inactive vehicles." Both, in one
 * list, with inactive ones sorted last and visibly marked - hiding them behind
 * a filter would make a deactivated vehicle look deleted, which is exactly the
 * confusion SRS 21.5 exists to avoid.
 */
import { ChevronRight, Plus, Truck } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

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
  const { items: vehicles, total } = await vehicleService.listPage(actor, {}, pagination);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.vehiclesTitle}
        description={UI.common.total(total)}
        action={
          <Link
            href="/admin/vehicles/new"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.vehicleCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.vehicleUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.vehicleDeleted} /> : null}

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
            <Th>{FIELD_LABELS.registrationPlate}</Th>
            <Th>{FIELD_LABELS.name}</Th>
            <Th>{UI.common.status}</Th>
            <Th />
          </tr>
        }
        row={(vehicle) => (
          <>
            <Td className="font-mono font-medium whitespace-nowrap">
              {vehicle.registrationPlate}
            </Td>
            <Td className="text-muted-foreground">{vehicle.referenceName ?? UI.common.none}</Td>
            <Td>
              <Badge subtle tone={vehicle.isActive ? 'approved' : 'neutral'}>
                {vehicle.isActive ? UI.common.active : UI.common.inactive}
              </Badge>
            </Td>
            <Td className="text-right">
              <Link
                href={`/admin/vehicles/${vehicle.id}`}
                className="text-primary text-xs font-medium hover:underline"
              >
                {UI.common.edit}
              </Link>
            </Td>
          </>
        )}
        card={(vehicle) => (
          <Link
            href={`/admin/vehicles/${vehicle.id}`}
            className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3.5 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium">{vehicle.registrationPlate}</p>
              <p className="text-muted-foreground truncate text-xs">
                {vehicle.referenceName ?? UI.common.none}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge subtle tone={vehicle.isActive ? 'approved' : 'neutral'}>
                {vehicle.isActive ? UI.common.active : UI.common.inactive}
              </Badge>
              <ChevronRight aria-hidden className="text-muted-foreground size-4" />
            </div>
          </Link>
        )}
      />

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
