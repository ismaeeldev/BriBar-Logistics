/**
 * Vehicle master list (SRS 13.2, 17.3 `/admin/vehicles`).
 *
 * "Admin shall be able to view active and inactive vehicles." Both, in one
 * list, with inactive ones sorted last and visibly marked - hiding them behind
 * a filter would make a deactivated vehicle look deleted, which is exactly the
 * confusion SRS 21.5 exists to avoid.
 */
import { Plus, Truck } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';

export const metadata = { title: UI.admin.vehiclesTitle };

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const actor = await requireAdmin();
  const flags = await searchParams;
  const vehicles = await vehicleService.list(actor, {});

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.vehiclesTitle}
        description={UI.common.total(vehicles.length)}
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

      {flags.created ? <Alert tone="success" title={UI.admin.vehicleCreated} /> : null}
      {flags.updated ? <Alert tone="success" title={UI.admin.vehicleUpdated} /> : null}

      {vehicles.length === 0 ? (
        <Card>
          <EmptyState
            icon={Truck}
            title={UI.admin.noVehicles}
            description={UI.admin.noVehiclesHint}
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>{FIELD_LABELS.registrationPlate}</Th>
                <Th>{FIELD_LABELS.name}</Th>
                <Th>{UI.common.status}</Th>
                <Th />
              </tr>
            </Thead>
            <Tbody>
              {vehicles.map((vehicle) => (
                <Tr key={vehicle.id}>
                  <Td className="font-mono font-medium whitespace-nowrap">
                    {vehicle.registrationPlate}
                  </Td>
                  <Td className="text-muted-foreground">{vehicle.referenceName ?? '—'}</Td>
                  <Td>
                    <Badge tone={vehicle.isActive ? 'approved' : 'neutral'}>
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
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
