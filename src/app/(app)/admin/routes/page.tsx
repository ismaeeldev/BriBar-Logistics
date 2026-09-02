/**
 * Route/Contract master list (SRS 14.2, 17.3 `/admin/routes`).
 */
import { ChevronRight, Plus, Route as RouteIcon } from 'lucide-react';
import Link from 'next/link';

import { Alert, Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { routeService } from '@/modules/routes/service/route.service';
import { paginationSchema } from '@/modules/shared/schemas/common';

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
  const { items: routes, total } = await routeService.listPage(actor, {}, pagination);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.routesTitle}
        description={UI.common.total(total)}
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

      {params['created'] ? <Alert tone="success" title={UI.admin.routeCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.routeUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.routeDeleted} /> : null}

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
            <Th>{FIELD_LABELS.routeCode}</Th>
            <Th>{FIELD_LABELS.name}</Th>
            <Th>{FIELD_LABELS.origin}</Th>
            <Th>{FIELD_LABELS.destination}</Th>
            <Th>{UI.common.status}</Th>
            <Th />
          </tr>
        }
        row={(route) => (
          <>
            <Td className="font-mono font-medium whitespace-nowrap">{route.code}</Td>
            <Td>{route.name}</Td>
            <Td className="text-muted-foreground max-w-40 truncate">{route.origin}</Td>
            <Td className="text-muted-foreground max-w-40 truncate">{route.destination}</Td>
            <Td>
              <Badge subtle tone={route.isActive ? 'approved' : 'neutral'}>
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
          </>
        )}
        card={(route) => (
          <Link
            href={`/admin/routes/${route.id}`}
            className="hover:bg-muted/50 block px-4 py-3.5 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm">
                <span className="font-mono font-medium">{route.code}</span>
                <span className="text-muted-foreground"> · {route.name}</span>
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge subtle tone={route.isActive ? 'approved' : 'neutral'}>
                  {route.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                </Badge>
                <ChevronRight aria-hidden className="text-muted-foreground size-4" />
              </div>
            </div>
            {/* Origin and destination read as a journey rather than two cells. */}
            <p className="text-muted-foreground mt-1.5 truncate text-xs">
              {route.origin} → {route.destination}
            </p>
          </Link>
        )}
      />

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
