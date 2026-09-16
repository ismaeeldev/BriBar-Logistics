/**
 * End client master list (client change request 2026-09-17, `/admin/end-clients`).
 *
 * Mirrors `/admin/clients`: active and inactive end clients in one list by
 * default, inactive ones sorted last and visibly marked (SRS 21.5's
 * convention).
 */
import { ChevronRight, Handshake, Plus } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, EmptyState, PageHeader, StatePill } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar, ListFilters } from '@/components/ui/search-bar';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Td, Th, SortableTh } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { endClientService } from '@/modules/end-clients/service/end-client.service';
import { paginationSchema } from '@/modules/shared/schemas/common';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.endClientsTitle };

export default async function AdminEndClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const pagination = paginationSchema.parse(params);
  const { items: endClients, total } = await endClientService.listPage(
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
        title={UI.admin.endClientsTitle}
        section={UI.nav.sectionMasterData}
        description={UI.common.total(total)}
        statusPill={<StatePill isActive={true} label={UI.common.active} />}
        search={<SearchBar placeholder={UI.admin.searchEndClients} className="w-full" />}
        filters={<ListFilters />}
        action={
          <Link href="/admin/end-clients/new" className={cn(buttonVariants({ size: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            {UI.common.new}
          </Link>
        }
      />

      {params['created'] ? <Alert tone="success" title={UI.admin.endClientCreated} /> : null}
      {params['updated'] ? <Alert tone="success" title={UI.admin.endClientUpdated} /> : null}
      {params['deleted'] ? <Alert tone="success" title={UI.admin.endClientDeleted} /> : null}

      <div className="pt-2">
        <ResponsiveList
          items={endClients}
          getKey={(endClient) => endClient.id}
          empty={
            <EmptyState
              icon={Handshake}
              title={UI.admin.noEndClients}
              description={UI.admin.noEndClientsHint}
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
          row={(endClient) => (
            <>
              <Td className="align-middle py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-600/10 text-teal-500 flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Handshake className="size-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">
                    {endClient.name}
                  </span>
                </div>
              </Td>
              <Td className="align-middle py-3">
                <span className="text-[13px] text-muted-foreground">
                  {endClient.taxId ?? UI.common.none}
                </span>
              </Td>
              <Td className="align-middle py-3">
                <StatePill
                  isActive={endClient.isActive}
                  label={endClient.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
                />
              </Td>
              <Td className="align-middle py-3">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/end-clients/${endClient.id}`}
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
          card={(endClient) => (
            <Link
              href={`/admin/end-clients/${endClient.id}`}
              className="group relative block p-4 transition-all hover:bg-muted/30 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 min-w-0">
                    <span className="text-foreground font-semibold text-sm truncate">
                      {endClient.name}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                    <Handshake className="size-3.5 shrink-0" />
                    <span className="truncate text-xs text-foreground/80">
                      {endClient.taxId ?? UI.common.none}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge
                    subtle
                    tone={endClient.isActive ? 'approved' : 'neutral'}
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                  >
                    {endClient.isActive ? UI.common.activeFeminine : UI.common.inactiveFeminine}
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
        basePath="/admin/end-clients"
        params={params}
      />
    </div>
  );
}
