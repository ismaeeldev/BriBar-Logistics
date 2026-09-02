/**
 * User/driver list (SRS 12.1, 17.3 `/admin/users`).
 *
 * SRS 12.1 names the columns: name, login identifier, role, default vehicle,
 * default route, active state. All six are here.
 */
import { ChevronRight, Plus, Users } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { CardField, ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';

export const metadata = { title: UI.nav.drivers };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  // One query string carries both the success flags and the page number: a
  // redirect after a save lands on `?created=1`, which is page 1 by default.
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items, total } = await userService.listPage(actor, {}, pagination);
  const users = items.map(toUserDto);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.usersTitle}
        description={UI.admin.accountCount(total)}
        action={
          <Link
            href="/admin/users/new"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden className="size-4" />
            {UI.common.newFeminine}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.accountCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.accountUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.accountDeleted} /> : null}

      <ResponsiveList
        items={users}
        getKey={(user) => user.id}
        empty={<EmptyState icon={Users} title={UI.admin.noAccounts} />}
        head={
          <tr>
            <Th>{FIELD_LABELS.name}</Th>
            <Th>{FIELD_LABELS.loginIdentifier}</Th>
            <Th>{FIELD_LABELS.role}</Th>
            <Th className="hidden xl:table-cell">{FIELD_LABELS.defaultVehicle}</Th>
            <Th className="hidden xl:table-cell">{FIELD_LABELS.defaultRoute}</Th>
            <Th>{UI.common.status}</Th>
            <Th />
          </tr>
        }
        row={(user) => (
          <>
            <Td className="font-medium whitespace-nowrap">
              {user.name}
              {user.id === actor.userId ? (
                <span className="text-muted-foreground ml-1.5 text-xs">{UI.common.you}</span>
              ) : null}
            </Td>
            <Td className="text-muted-foreground font-mono">{user.loginIdentifier}</Td>
            <Td>
              <Badge subtle tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </Td>
            <Td className="text-muted-foreground hidden font-mono whitespace-nowrap xl:table-cell">
              {user.defaultVehicle?.registrationPlate ?? UI.common.none}
            </Td>
            <Td className="text-muted-foreground hidden font-mono whitespace-nowrap xl:table-cell">
              {user.defaultRoute?.code ?? UI.common.none}
            </Td>
            <Td>
              <Badge subtle tone={user.isActive ? 'approved' : 'neutral'}>
                {user.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
              </Badge>
            </Td>
            <Td className="text-right">
              <Link
                href={`/admin/users/${user.id}`}
                className="text-primary text-xs font-medium hover:underline"
              >
                {UI.common.edit}
              </Link>
            </Td>
          </>
        )}
        card={(user) => (
          <Link
            href={`/admin/users/${user.id}`}
            className="hover:bg-muted/50 block px-4 py-3.5 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.name}
                  {user.id === actor.userId ? (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      {UI.common.you}
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground font-mono text-xs">
                  {user.loginIdentifier}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge subtle tone={user.isActive ? 'approved' : 'neutral'}>
                  {user.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                </Badge>
                <ChevronRight aria-hidden className="text-muted-foreground size-4" />
              </div>
            </div>

            <dl className="mt-2 grid grid-cols-3 gap-3">
              <CardField label={FIELD_LABELS.role}>{ROLE_LABELS[user.role]}</CardField>
              <CardField label={FIELD_LABELS.defaultVehicle} mono>
                {user.defaultVehicle?.registrationPlate ?? UI.common.none}
              </CardField>
              <CardField label={FIELD_LABELS.defaultRoute} mono>
                {user.defaultRoute?.code ?? UI.common.none}
              </CardField>
            </dl>
          </Link>
        )}
      />

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/admin/users"
        params={params}
      />
    </div>
  );
}
