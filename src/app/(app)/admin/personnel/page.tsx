/**
 * Personnel-cost list (ERP roadmap Phase 5, `/admin/personnel`).
 *
 * Admin-only, same shape as `/admin/refuellings`: no active/inactive filter,
 * newest year/month first with pagination.
 */
import { ChevronRight, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { personnelCostService } from '@/modules/personnel/service/personnel-cost.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.personnel.title };

function monthLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export default async function AdminPersonnelCostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: costs, total } = await personnelCostService.listPage(actor, {}, pagination);

  return (
    <div className="space-y-5">
      <PageHeader
        title={UI.admin.personnel.title}
        section={UI.nav.sectionFleet}
        description={UI.common.total(total)}
        action={
          <Link href="/admin/personnel/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.personnel.created} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.personnel.deleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={costs}
          getKey={(cost) => cost.id}
          empty={
            <EmptyState
              icon={Wallet}
              title={UI.admin.personnel.noCosts}
              description={UI.admin.personnel.noCostsHint}
            />
          }
          head={
            <tr>
              <Th>{FIELD_LABELS.employee}</Th>
              <Th>{UI.admin.taxes.periodColumn}</Th>
              <Th>{FIELD_LABELS.totalCost}</Th>
              <Th className="hidden lg:table-cell">{FIELD_LABELS.dailyFixedCost}</Th>
              <Th />
            </tr>
          }
          row={(cost) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-violet-600/10 text-violet-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Wallet className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">
                    {cost.user.name}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {monthLabel(cost.year, cost.month)}
                </span>
              </Td>
              <Td className="align-middle py-3 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-foreground">
                  {formatEuros(cost.totalCents, NUMBER_LOCALE)}
                </span>
              </Td>
              <Td className="hidden align-middle py-3 lg:table-cell whitespace-nowrap">
                <span className="text-[13px] text-muted-foreground">
                  {formatEuros(cost.dailyFixedCostCents, NUMBER_LOCALE)}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/personnel/${cost.id}`}
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
          card={(cost) => (
            <Link
              href={`/admin/personnel/${cost.id}`}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-semibold text-sm truncate">
                      {cost.user.name}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {monthLabel(cost.year, cost.month)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {formatEuros(cost.totalCents, NUMBER_LOCALE)}
                  </span>
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
        basePath="/admin/personnel"
        params={params}
      />
    </div>
  );
}
