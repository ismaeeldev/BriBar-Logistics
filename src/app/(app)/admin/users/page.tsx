/**
 * User/driver list (SRS 12.1, 17.3 `/admin/users`).
 *
 * SRS 12.1 names the columns: name, login identifier, role, default vehicle,
 * default route, active state. All six are here.
 */
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/i18n/messages';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';

export const metadata = { title: 'Conductores' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const actor = await requireAdmin();
  const flags = await searchParams;
  const users = (await userService.list(actor)).map(toUserDto);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conductores y administradores"
        description={`${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'}`}
        action={
          <Link
            href="/admin/users/new"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden className="size-4" />
            Nueva
          </Link>
        }
      />

      {flags.created ? <Alert tone="success" title="Cuenta creada" /> : null}
      {flags.updated ? <Alert tone="success" title="Cuenta actualizada" /> : null}

      {users.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No hay cuentas" />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Usuario</Th>
                <Th>Rol</Th>
                <Th>Vehículo predet.</Th>
                <Th>Ruta predet.</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </Thead>
            <Tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td className="font-medium whitespace-nowrap">
                    {user.name}
                    {user.id === actor.userId ? (
                      <span className="text-muted-foreground ml-1.5 text-xs">(usted)</span>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground font-mono">{user.loginIdentifier}</Td>
                  <Td>
                    <Badge tone={user.role === 'ADMIN' ? 'pending' : 'neutral'}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground font-mono whitespace-nowrap">
                    {user.defaultVehicle?.registrationPlate ?? '—'}
                  </Td>
                  <Td className="text-muted-foreground font-mono whitespace-nowrap">
                    {user.defaultRoute?.code ?? '—'}
                  </Td>
                  <Td>
                    <Badge tone={user.isActive ? 'approved' : 'neutral'}>
                      {user.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
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
