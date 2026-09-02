/**
 * Service history (SRS 17.2 `/services`).
 *
 * "Current Driver's service history. DRIVER sees only own services."
 *
 * The scoping is not done here. `serviceService.list` pushes the driver's own
 * id into the SQL `where` for any non-admin, so this page could not show
 * someone else's services even if it tried (SRS 9.7).
 */
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { ServiceCard } from '@/components/services/service-card';
import { Pagination } from '@/components/ui/pagination';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceFilterSchema } from '@/modules/services/schemas/service.schema';
import { toServiceListItem } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: UI.driver.history };

const FILTERS = [
  { value: '', label: UI.common.all },
  { value: ServiceStatus.PENDING_APPROVAL, label: SERVICE_STATUS_LABELS.PENDING_APPROVAL },
  { value: ServiceStatus.APPROVED, label: SERVICE_STATUS_LABELS.APPROVED },
] as const;

export default async function ServiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;

  // Parsed through the same schema the API uses, so a hand-edited query string
  // is validated identically whichever door it comes through.
  const parsed = serviceFilterSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 25 };

  const { items, total, pagination } = await serviceService.list(actor, filters);
  const activeStatus = typeof params['status'] === 'string' ? params['status'] : '';

  return (
    <div className="space-y-5">
      <PageHeader title={UI.driver.history} description={UI.driver.serviceCount(total)} />

      {/* Status filter. Links rather than a client-side control: the state
          lives in the URL, so a filtered view is shareable and survives a
          back-navigation. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const isActive = activeStatus === filter.value;
          return (
            <Link
              key={filter.value || 'all'}
              href={filter.value ? `/services?status=${filter.value}` : '/services'}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:bg-muted',
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={UI.driver.noServices}
            description={activeStatus ? UI.driver.noServicesFiltered : UI.driver.noServicesHint}
          />
        ) : (
          <div>
            {items.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        basePath="/services"
        params={params}
      />
    </div>
  );
}
