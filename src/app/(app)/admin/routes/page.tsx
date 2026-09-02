/**
 * Route/Contract master list (SRS 14.2, 17.3 `/admin/routes`).
 */
import { Plus, Route as RouteIcon } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';

export const metadata = { title: UI.admin.routesTitle };

export default async function AdminRoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const actor = await requireAdmin();
  const flags = await searchParams;
  const routes = await routeService.list(actor, {});

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.routesTitle}
        description={UI.common.total(routes.length)}
        action={
          <Link
            href="/admin/routes/new"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden className="size-4" />
            {UI.common.newFeminine}
          </Link>
        }
      />

      {flags.created ? <Alert tone="success" title={UI.admin.routeCreated} /> : null}
      {flags.updated ? <Alert tone="success" title={UI.admin.routeUpdated} /> : null}

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={RouteIcon}
            title={UI.admin.noRoutes}
            description={UI.admin.noRoutesHint}
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>{FIELD_LABELS.routeCode}</Th>
                <Th>{FIELD_LABELS.name}</Th>
                <Th>{FIELD_LABELS.origin}</Th>
                <Th>{FIELD_LABELS.destination}</Th>
                <Th>{UI.common.status}</Th>
                <Th />
              </tr>
            </Thead>
            <Tbody>
              {routes.map((route) => (
                <Tr key={route.id}>
                  <Td className="font-mono font-medium whitespace-nowrap">{route.code}</Td>
                  <Td>{route.name}</Td>
                  <Td className="text-muted-foreground max-w-40 truncate">{route.origin}</Td>
                  <Td className="text-muted-foreground max-w-40 truncate">
                    {route.destination}
                  </Td>
                  <Td>
                    <Badge tone={route.isActive ? 'approved' : 'neutral'}>
                      {route.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/routes/${route.id}`}
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
