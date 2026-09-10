/**
 * One simple lookup list (ERP roadmap Phase 1, `/admin/lists/[kind]`).
 *
 * A single dynamic route serves every kind (fuel types, payment methods,
 * supplement types, end clients) rather than four near-identical route
 * trees — `lookup.service.ts` already scopes every query to `kind`, so this
 * page differs from a fourth copy of `/admin/vehicles/page.tsx` only in the
 * two columns a single-field record doesn't need.
 */
import { ArrowLeft, ChevronRight, ListTree, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Alert, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ListFilters, SearchBar } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { SortableTh, Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, LOOKUP_KIND_LABELS, UI } from '@/lib/i18n/messages';
import { isLookupKind } from '@/modules/lookup/lookup-kinds';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: isLookupKind(kind) ? LOOKUP_KIND_LABELS[kind] : UI.admin.lookup.sectionTitle };
}

export default async function AdminLookupListPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const { kind: rawKind } = await params;
  if (!isLookupKind(rawKind)) notFound();
  const kind = rawKind;

  const searchParamsResolved = await searchParams;
  const pagination = paginationSchema.parse(searchParamsResolved);
  const { items, total } = await lookupService.listPage(
    actor,
    kind,
    {
      ...(pagination.q ? { q: pagination.q } : {}),
      ...(pagination.isActive !== undefined ? { isActive: pagination.isActive } : {}),
    },
    pagination,
  );

  const basePath = `/admin/lists/${kind}`;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/lists"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.lookup.backToLists}
      </Link>

      <PageHeader
        title={LOOKUP_KIND_LABELS[kind]}
        section={UI.nav.sectionSettings}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.lookup.search} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link href={`${basePath}/new`} className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {searchParamsResolved['created'] ? (
        <Alert tone="success" title={UI.admin.lookup.created} />
      ) : null}
      {searchParamsResolved['updated'] ? (
        <Alert tone="success" title={UI.admin.lookup.updated} />
      ) : null}
      {searchParamsResolved['deleted'] ? (
        <Alert tone="success" title={UI.admin.lookup.deleted} />
      ) : null}

      <div className="pt-2">
        <ResponsiveList
          items={items}
          getKey={(item) => item.id}
          empty={
            <EmptyState
              icon={ListTree}
              title={UI.admin.lookup.empty}
              description={UI.admin.lookup.emptyHint}
            />
          }
          head={
            <tr>
              <SortableTh sortKey="name">{FIELD_LABELS.name}</SortableTh>
              <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
              <Th />
            </tr>
          }
          row={(item) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground">{item.name}</span>
              </Td>
              <Td className="align-middle py-3">
                <StatePill
                  isActive={item.isActive}
                  label={item.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                />
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`${basePath}/${item.id}`}
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
          card={(item) => (
            <Link
              href={`${basePath}/${item.id}`}
              className="group relative flex items-center justify-between gap-3 p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <span className="text-foreground truncate text-sm font-semibold">{item.name}</span>
              <div className="flex shrink-0 items-center gap-3">
                <StatePill
                  isActive={item.isActive}
                  label={item.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                />
                <ChevronRight
                  aria-hidden
                  className="text-muted-foreground size-4 group-hover:text-foreground transition-colors"
                />
              </div>
            </Link>
          )}
        />
      </div>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath={basePath}
        params={searchParamsResolved}
      />
    </div>
  );
}
