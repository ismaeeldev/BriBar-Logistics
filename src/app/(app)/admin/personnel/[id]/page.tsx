/**
 * Edit a personnel cost (ERP roadmap Phase 5, `/admin/personnel/[id]`).
 *
 * Nothing references a `PersonnelCost` row, so it is always deletable — same
 * reasoning as the refuelling and daily-km-log edit pages.
 */
import { ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deletePersonnelCostAction, updatePersonnelCostAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { PersonnelCostForm } from '@/components/admin/personnel-cost-form';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { formatBusinessDateValue } from '@/lib/time/business-date';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { centsToInputValue, formatEuros } from '@/lib/money/money';
import { Td, Th } from '@/components/ui/table';
import { personnelCostService } from '@/modules/personnel/service/personnel-cost.service';
import { userRepository } from '@/modules/users/repository/user.repository';

export const metadata = { title: UI.admin.personnel.editCost };

export default async function EditPersonnelCostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let cost;
  try {
    cost = await personnelCostService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const users = await userRepository.list({ isActive: true });
  const periodLabel = `${String(cost.month).padStart(2, '0')}/${cost.year}`;
  const servicesWorked = await personnelCostService.getServicesWorked(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/personnel"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.personnel.title}
      </Link>

      <PageHeader
        title={UI.admin.personnel.editCost}
        section={UI.nav.sectionFleet}
        description={`${cost.user.name} · ${periodLabel}`}
      />

      {flags.updated ? <Alert tone="success" title={UI.admin.personnel.updated} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <Calculator className="size-5 text-emerald-600" />
            {FIELD_LABELS.totalCost}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1">
            <DetailRow
              label={FIELD_LABELS.totalCost}
              value={formatEuros(cost.totalCents, NUMBER_LOCALE)}
            />
            <DetailRow
              label={UI.admin.personnel.dailyFixedCostLabel}
              value={formatEuros(cost.dailyFixedCostCents, NUMBER_LOCALE)}
            />
          </dl>
        </CardBody>
      </Card>

      <PersonnelCostForm
        action={updatePersonnelCostAction.bind(null, id)}
        submitLabel={UI.common.save}
        context={{ users }}
        initial={{
          userId: cost.userId,
          year: String(cost.year),
          month: String(cost.month),
          base: centsToInputValue(cost.baseCents),
          overtime: cost.overtimeCents !== null ? centsToInputValue(cost.overtimeCents) : '',
          allowances:
            cost.allowancesCents !== null ? centsToInputValue(cost.allowancesCents) : '',
          other: cost.otherCents !== null ? centsToInputValue(cost.otherCents) : '',
          notes: cost.notes ?? '',
        }}
      />

      <DeleteRecord
        action={deletePersonnelCostAction.bind(null, id)}
        name={`${cost.user.name} · ${periodLabel}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Servicios realizados
          </CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {servicesWorked.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No hay servicios registrados en este periodo.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <Th>{FIELD_LABELS.date}</Th>
                  <Th>{FIELD_LABELS.route}</Th>
                  <Th>{FIELD_LABELS.vehicle}</Th>
                  <Th>Facturación</Th>
                  <Th>Rol</Th>
                </tr>
              </thead>
              <tbody>
                {servicesWorked.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <Td className="py-2.5">
                      <Link href={`/admin/services/${s.id}`} className="hover:underline text-foreground">
                        {formatBusinessDateValue(s.date)}
                      </Link>
                    </Td>
                    <Td className="py-2.5 text-muted-foreground">{s.route}</Td>
                    <Td className="py-2.5 font-semibold uppercase text-foreground">{s.vehicle}</Td>
                    <Td className="py-2.5">
                      {s.baseCents !== null ? formatEuros(s.baseCents, NUMBER_LOCALE) : '—'}
                    </Td>
                    <Td className="py-2.5 text-muted-foreground">{s.role}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
