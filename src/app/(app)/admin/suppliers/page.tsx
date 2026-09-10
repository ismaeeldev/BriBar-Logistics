/**
 * Supplier master list (ERP roadmap Phase 3, `/admin/suppliers`).
 *
 * Same shape as `/admin/clients` — see that page's doc comment.
 */
import { ChevronRight, Plus, Store } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar, ListFilters } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th, SortableTh } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.suppliersTitle };

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: suppliers, total } = await supplierService.listPage(
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
        title={UI.admin.suppliersTitle}
        section={UI.nav.sectionMasterData}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchSuppliers} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link href="/admin/suppliers/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.supplierCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.supplierUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.supplierDeleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={suppliers}
          getKey={(supplier) => supplier.id}
          empty={
            <EmptyState
              icon={Store}
              title={UI.admin.noSuppliers}
              description={UI.admin.noSuppliersHint}
            />
          }
          head={
            <tr>
              <SortableTh sortKey="name">{FIELD_LABELS.name}</SortableTh>
              <Th>{FIELD_LABELS.taxId}</Th>
              <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
              <Th />
            </tr>
          }
          row={(supplier) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-600/10 text-orange-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Store className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">
                    {supplier.name}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3">
                <span className="text-[13px] text-muted-foreground">
                  {supplier.taxId ?? UI.common.none}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <StatePill
                  isActive={supplier.isActive}
                  label={supplier.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                />
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/suppliers/${supplier.id}`}
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
          card={(supplier) => (
            <Link
              href={`/admin/suppliers/${supplier.id}`}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-semibold text-sm truncate">
                      {supplier.name}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Store className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {supplier.taxId ?? UI.common.none}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge
                    subtle
                    tone={supplier.isActive ? 'approved' : 'neutral'}
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                  >
                    {supplier.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                  </Badge>
                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground size-4 group-hover:text-foreground transition-colors"
                  />
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
        basePath="/admin/suppliers"
        params={params}
      />
    </div>
  );
}
