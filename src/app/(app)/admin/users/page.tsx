/**
 * User/driver list (SRS 12.1, 17.3 `/admin/users`).
 *
 * SRS 12.1 names the columns: name, login identifier, role, default vehicle,
 * default route, active state. All six are here.
 */
import { ChevronRight, Plus, Users, IdCard, Map } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar, ListFilters } from '@/components/ui/search-bar';
import { CardField, ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th, SortableTh } from '@/components/ui/table';
import { getUserColor, getInitials } from '@/lib/utils/color';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { Role } from '@/modules/services/domain/service-status';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { toUserDto } from '@/modules/users/service/user.presenter';
import { userService } from '@/modules/users/service/user.service';
import { cn } from '@/lib/utils/cn';

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
  // `role` arrives as a raw query string; narrow it to the enum so an
  // unrecognised value is ignored rather than reaching Prisma and 500ing.
  const roleFilter =
    pagination.role === Role.ADMIN || pagination.role === Role.DRIVER ? pagination.role : undefined;
  const { items, total } = await userService.listPage(
    actor,
    {
      ...(pagination.q ? { q: pagination.q } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(pagination.isActive !== undefined ? { isActive: pagination.isActive } : {}),
    },
    pagination,
  );
  const users = items.map(toUserDto);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.usersTitle}
        section={UI.nav.sectionMasterData}
        description={UI.admin.accountCount(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchUsers} className="w-full" />}
        filters={<ListFilters showRoleFilter />}
        action={
          <Link href="/admin/users/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.newFeminine}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.accountCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.accountUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.accountDeleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={users}
        getKey={(user) => user.id}
        empty={<EmptyState icon={Users} title={UI.admin.noAccounts} />}
        head={
          <tr>
            <SortableTh sortKey="name">{FIELD_LABELS.name}</SortableTh>
            <SortableTh sortKey="loginIdentifier">{FIELD_LABELS.loginIdentifier}</SortableTh>
            <SortableTh sortKey="role">{FIELD_LABELS.role}</SortableTh>
            <SortableTh sortKey="defaultVehicle" className="hidden xl:table-cell">{FIELD_LABELS.defaultVehicle}</SortableTh>
            <Th className="hidden xl:table-cell">{FIELD_LABELS.defaultRoute}</Th>
            <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
            <Th />
          </tr>
        }
        row={(user) => (
          <>
            <Td className="align-middle py-3 whitespace-nowrap">
              <div className="flex items-center gap-3">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${getUserColor(user.name).bg} ${getUserColor(user.name).text} text-[11px] font-semibold ring-1 ring-inset ${getUserColor(user.name).ring}`}>
                  {getInitials(user.name)}
                </div>
                <div>
                  <span className="text-[14px] font-bold text-foreground leading-none">{user.name}</span>
                  {user.id === actor.userId ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 ml-2 rounded bg-muted/50 text-[10px] font-mono font-medium text-muted-foreground border border-border/50">
                      {UI.common.you}
                    </span>
                  ) : null}
                </div>
              </div>
            </Td>
            <Td className="align-middle py-3 whitespace-nowrap">
              <span className="text-[13px] text-muted-foreground font-medium">{user.loginIdentifier}</span>
            </Td>
            <Td className="align-middle py-3">
              <Badge tone={user.role === 'ADMIN' ? 'admin' : 'driver'}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </Td>
            <Td className="hidden whitespace-nowrap xl:table-cell align-middle py-3">
              {user.defaultVehicle ? (
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  {user.defaultVehicle.registrationPlate}
                </div>
              ) : (
                <span className="text-[13px] font-medium text-muted-foreground">{UI.common.none}</span>
              )}
            </Td>
            <Td className="hidden whitespace-nowrap xl:table-cell align-middle py-3">
              {user.defaultRoute ? (
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Map className="size-3.5 text-muted-foreground" />
                  {user.defaultRoute.code}
                </div>
              ) : (
                <span className="text-[13px] font-medium text-muted-foreground">{UI.common.none}</span>
              )}
            </Td>
            <Td className="align-middle py-3">
              <StatePill isActive={user.isActive} label={user.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine} />
            </Td>
            <Td className="align-middle py-3">
              <div className="flex justify-end">
                <Link
                  href={`/admin/users/${user.id}`}
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
        card={(user) => (
          <Link
            href={`/admin/users/${user.id}`}
            className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 min-w-0">
                  <span className="text-foreground font-semibold text-sm truncate">
                    {user.name}
                  </span>
                  {user.id === actor.userId ? (
                    <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                      {UI.common.you}
                    </span>
                  ) : null}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5 shrink-0" />
                  <span className="truncate text-xs text-foreground font-medium">{user.loginIdentifier}</span>
                  <span className="text-border mx-1">•</span>
                  <span className="text-xs">{ROLE_LABELS[user.role]}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge subtle tone={user.isActive ? 'approved' : 'neutral'} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                  {user.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                </Badge>
                <ChevronRight aria-hidden className="text-muted-foreground size-4 group-hover:text-foreground transition-colors" />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 pl-2 border-t border-border/40 pt-3">
              <CardField label={FIELD_LABELS.defaultVehicle}>
                {user.defaultVehicle?.registrationPlate ?? UI.common.none}
              </CardField>
              <CardField label={FIELD_LABELS.defaultRoute}>
                {user.defaultRoute?.code ?? UI.common.none}
              </CardField>
            </dl>
          </Link>
        )}
      />
      </div>

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
