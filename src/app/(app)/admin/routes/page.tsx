/**
 * Route/Contract master list (SRS 14.2, 17.3 `/admin/routes`).
 */
import { ChevronRight, Plus, Route as RouteIcon, MapPin, Map } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar, ListFilters } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th, SortableTh } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.routesTitle };

export default async function AdminRoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  // One query string carries both the success flags and the page number: a
  // redirect after a save lands on `?created=1`, which is page 1 by default.
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: routes, total } = await routeService.listPage(
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
        title={UI.admin.routesTitle}
        section={UI.nav.sectionMasterData}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchRoutes} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link href="/admin/routes/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.routeCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.routeUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.routeDeleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={routes}
        getKey={(route) => route.id}
        empty={
          <EmptyState
            icon={RouteIcon}
            title={UI.admin.noRoutes}
            description={UI.admin.noRoutesHint}
          />
        }
        head={
          <tr>
            <SortableTh sortKey="code">{FIELD_LABELS.routeCode}</SortableTh>
            <SortableTh sortKey="name">{FIELD_LABELS.name}</SortableTh>
            <Th className="w-1/2">{UI.admin.routeColumn}</Th>
            <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
            <Th />
          </tr>
        }
        row={(route) => (
          <>
            <Td className="align-middle py-3 whitespace-nowrap">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600/10 text-orange-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <Map className="size-4.5" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-[14px] font-bold text-foreground leading-none uppercase tracking-wide">
                    {route.code}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground leading-none">
                    {UI.common.code}
                  </span>
                </div>
              </div>
            </Td>
            <Td className="align-middle py-3 whitespace-nowrap">
              <span className="text-[13px] font-medium text-foreground">{route.name}</span>
            </Td>
            <Td className="align-middle py-3 max-w-48">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3 text-blue-500 shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate max-w-[5rem]">{route.origin.length > 12 ? route.origin.slice(0, 12) + '…' : route.origin}</span>
                <span className="text-muted-foreground/40 shrink-0 text-[10px]">›</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[5rem]">{route.destination.length > 12 ? route.destination.slice(0, 12) + '…' : route.destination}</span>
              </div>
            </Td>
            <Td className="align-middle py-3">
              <StatePill isActive={route.isActive} label={route.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine} />
            </Td>
            <Td className="align-middle py-3">
              <div className="flex justify-end">
                <Link
                  href={`/admin/routes/${route.id}`}
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
        card={(route) => (
          <Link
            href={`/admin/routes/${route.id}`}
            className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 min-w-0">
                  <span className="text-foreground font-semibold text-sm truncate" title={route.code}>
                    {route.code.length > 10 ? route.code.slice(0, 10) + '…' : route.code}
                  </span>
                  <span className="text-muted-foreground text-xs truncate" title={route.name}>{route.name}</span>
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <RouteIcon className="size-3.5 shrink-0" />
                  <span className="truncate text-[11px] text-foreground/80" title={`${route.origin} → ${route.destination}`}>
                    {route.origin.length > 15 ? route.origin.slice(0, 15) + '…' : route.origin} → {route.destination.length > 15 ? route.destination.slice(0, 15) + '…' : route.destination}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge subtle tone={route.isActive ? 'approved' : 'neutral'} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                  {route.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
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
        basePath="/admin/routes"
        params={params}
      />
    </div>
  );
}
