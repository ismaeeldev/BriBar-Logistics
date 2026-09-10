/**
 * Expense category master list (ERP roadmap Phase 3, `/admin/expense-categories`).
 */
import { ChevronRight, Plus, Tags } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ListFilters, SearchBar } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { SortableTh, Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { EXPENSE_TYPE_LABELS, FIELD_LABELS, UI, VAT_RATE_LABELS } from '@/lib/i18n/messages';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.expenseCategories.title };

export default async function AdminExpenseCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: categories, total } = await expenseCategoryService.listPage(
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
        title={UI.admin.expenseCategories.title}
        section={UI.nav.sectionSettings}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.common.searchPlaceholder} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link
            href="/admin/expense-categories/new"
            className={cn(buttonVariants({ size: 'default' }))}
          >
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? (
        <Alert tone="success" title={UI.admin.expenseCategories.created} />
      ) : null}
      {params['updated'] ? (
        <Alert tone="success" title={UI.admin.expenseCategories.updated} />
      ) : null}
      {params['deleted'] ? (
        <Alert tone="success" title={UI.admin.expenseCategories.deleted} />
      ) : null}

      <div className="pt-2">
        <ResponsiveList
          items={categories}
          getKey={(category) => category.id}
          empty={
            <EmptyState
              icon={Tags}
              title={UI.admin.expenseCategories.empty}
              description={UI.admin.expenseCategories.emptyHint}
            />
          }
          head={
            <tr>
              <SortableTh sortKey="name">{FIELD_LABELS.name}</SortableTh>
              <Th>{FIELD_LABELS.expenseType}</Th>
              <Th>{FIELD_LABELS.vatRate}</Th>
              <SortableTh sortKey="isActive">{UI.common.status}</SortableTh>
              <Th />
            </tr>
          }
          row={(category) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-violet-600/10 text-violet-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Tags className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">
                    {category.name}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3">
                <span className="text-[13px] text-muted-foreground">
                  {EXPENSE_TYPE_LABELS[category.expenseType]}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <span className="text-[13px] text-muted-foreground">
                  {VAT_RATE_LABELS[category.defaultVatRate]}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <StatePill
                  isActive={category.isActive}
                  label={category.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                />
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/expense-categories/${category.id}`}
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
          card={(category) => (
            <Link
              href={`/admin/expense-categories/${category.id}`}
              className="group relative flex items-center justify-between gap-3 p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="min-w-0">
                <span className="text-foreground truncate text-sm font-semibold">
                  {category.name}
                </span>
                <p className="text-muted-foreground truncate text-xs">
                  {EXPENSE_TYPE_LABELS[category.expenseType]} ·{' '}
                  {VAT_RATE_LABELS[category.defaultVatRate]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatePill
                  isActive={category.isActive}
                  label={category.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
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
        basePath="/admin/expense-categories"
        params={params}
      />
    </div>
  );
}
