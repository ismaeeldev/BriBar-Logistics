/**
 * Route/Contract master list (SRS 14.2, 17.3 `/admin/routes`).
 */
import { Plus, Route as RouteIcon } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { routeService } from '@/modules/routes/service/route.service';

export const metadata = { title: 'Rutas' };

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
        title="Rutas / Contratos"
        description={`${routes.length} en total`}
        action={
          <Link
            href="/admin/routes/new"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden className="size-4" />
            Nueva
          </Link>
        }
      />

      {flags.created ? <Alert tone="success" title="Ruta creada" /> : null}
      {flags.updated ? <Alert tone="success" title="Ruta actualizada" /> : null}

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={RouteIcon}
            title="No hay rutas"
            description="Cree una ruta y asígnela a un conductor para que pueda registrar servicios."
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Origen</Th>
                <Th>Destino</Th>
                <Th>Estado</Th>
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
                      {route.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/routes/${route.id}`}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Editar
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
