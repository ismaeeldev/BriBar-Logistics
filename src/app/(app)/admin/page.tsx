/**
 * Admin dashboard (SRS 16.1, 16.2).
 *
 * "The Admin Dashboard shall prioritize services awaiting review while
 * providing direct access to master-data management."
 *
 * So the approval queue is the page, not a panel on it. The master-data links
 * live in the navigation bar above rather than being repeated as tiles here —
 * duplicating them would push the queue below the fold on a laptop, which
 * inverts the priority the SRS states.
 */
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

import { AdminServiceRow } from '@/components/admin/admin-service-row';
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import { Table, TableWrap, Tbody, Th, Thead } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

export const metadata = { title: UI.admin.panelTitle };

export default async function AdminDashboard() {
  const actor = await requireAdmin();

  const [pending, recentlyApproved, approvedTotal] = await Promise.all([
    serviceRepository.listRecent(actor, [ServiceStatus.PENDING_APPROVAL], 25),
    serviceRepository.listRecent(actor, [ServiceStatus.APPROVED], 5),
    serviceRepository.countByStatus(actor, ServiceStatus.APPROVED),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={UI.admin.panelTitle}
        description={
          pending.length === 0
            ? UI.admin.nothingPending
            : UI.admin.pendingSummary(pending.length)
        }
      />

      <dl className="grid grid-cols-2 gap-3">
        <Stat
          label={SERVICE_STATUS_LABELS.PENDING_APPROVAL}
          value={pending.length}
          tone={pending.length > 0 ? 'pending' : 'neutral'}
        />
        <Stat label={SERVICE_STATUS_LABELS.APPROVED} value={approvedTotal} tone="neutral" />
      </dl>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <ClipboardCheck aria-hidden className="text-pending size-4" />
            {UI.admin.approvalQueue}
          </h2>
          <Link
            href="/admin/services"
            className="text-primary text-xs font-medium hover:underline"
          >
            {UI.admin.viewAllServices}
          </Link>
        </div>

        {pending.length === 0 ? (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title={UI.admin.allClear}
              description={UI.admin.allClearHint}
            />
          </Card>
        ) : (
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>{FIELD_LABELS.serviceDate}</Th>
                  <Th>{FIELD_LABELS.serviceCode}</Th>
                  <Th>{FIELD_LABELS.driver}</Th>
                  <Th>{UI.admin.routeColumn}</Th>
                  <Th>{FIELD_LABELS.vehicle}</Th>
                  <Th className="text-right">{FIELD_LABELS.actualKm}</Th>
                  <Th className="text-right">{FIELD_LABELS.serviceKm}</Th>
                  <Th />
                </tr>
              </Thead>
              <Tbody>
                {pending.map((service) => (
                  <AdminServiceRow key={service.id} service={toServiceListItem(service)} />
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {recentlyApproved.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">{UI.driver.recentlyApproved}</h2>
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>{FIELD_LABELS.serviceDate}</Th>
                  <Th>{FIELD_LABELS.serviceCode}</Th>
                  <Th>{FIELD_LABELS.driver}</Th>
                  <Th>{UI.admin.routeColumn}</Th>
                  <Th>{FIELD_LABELS.vehicle}</Th>
                  <Th className="text-right">{FIELD_LABELS.actualKm}</Th>
                  <Th className="text-right">{FIELD_LABELS.serviceKm}</Th>
                  <Th />
                </tr>
              </Thead>
              <Tbody>
                {recentlyApproved.map((service) => (
                  <AdminServiceRow key={service.id} service={toServiceListItem(service)} />
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'pending' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className="border-b-0 pb-0">
        <CardTitle className="text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <div className="px-4 pt-1 pb-4">
        <dd
          className={
            tone === 'pending'
              ? 'text-pending font-mono text-3xl font-semibold'
              : 'font-mono text-3xl font-semibold'
          }
        >
          {value}
        </dd>
      </div>
    </Card>
  );
}
