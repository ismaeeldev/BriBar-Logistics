/**
 * Edit a refuelling (ERP roadmap Phase 2, `/admin/refuellings/[id]`).
 *
 * Nothing references a `Refuelling` row (unlike a vehicle or a lookup item),
 * so it is always deletable — no `getDeletability` call, just the fixed
 * `{ canDelete: true }` `DeleteRecord` expects.
 */
import { ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteRefuellingAction, updateRefuellingAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { RefuellingForm } from '@/components/admin/refuelling-form';
import { Alert, Card, CardBody, CardHeader, CardTitle, DetailRow, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { centsToInputValue, formatEuros } from '@/lib/money/money';
import { formatLiters, millilitersToInputValue } from '@/lib/units/fuel';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { refuellingService } from '@/modules/refuelling/service/refuelling.service';
import { Role } from '@/modules/services/domain/service-status';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';

export const metadata = { title: UI.admin.refuelling.editRefuelling };

export default async function EditRefuellingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;

  let detail;
  try {
    detail = await refuellingService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }
  const { refuelling, kmSinceLastRefuel, consumptionMlPer100Km } = detail;

  const [vehicles, drivers, fuelTypes, gasStations, paymentMethods] = await Promise.all([
    vehicleRepository.list({ isActive: true }),
    userRepository.list({ role: Role.DRIVER, isActive: true }),
    lookupService.list(actor, 'FUEL_TYPE', { isActive: true }),
    lookupService.list(actor, 'GAS_STATION', { isActive: true }),
    lookupService.list(actor, 'PAYMENT_METHOD', { isActive: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/refuellings"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.refuelling.title}
      </Link>

      <PageHeader
        title={UI.admin.refuelling.editRefuelling}
        section={UI.nav.sectionFinance}
        description={`#${refuelling.refuelCode}`}
      />

      {flags.updated ? <Alert tone="success" title={UI.admin.refuelling.updated} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <Calculator className="size-5 text-emerald-600" />
            {UI.admin.refuelling.detailSectionTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1">
            <DetailRow
              label={FIELD_LABELS.baseAmount}
              value={formatEuros(refuelling.baseCents, NUMBER_LOCALE)}
            />
            <DetailRow
              label={FIELD_LABELS.vatAmount}
              value={formatEuros(refuelling.vatCents, NUMBER_LOCALE)}
            />
            <DetailRow
              label={FIELD_LABELS.kmSinceLastRefuel}
              value={
                kmSinceLastRefuel !== null
                  ? `${kmSinceLastRefuel} km`
                  : UI.admin.refuelling.kmSinceLastUnavailable
              }
            />
            <DetailRow
              label={FIELD_LABELS.consumption}
              value={
                consumptionMlPer100Km !== null
                  ? `${formatLiters(consumptionMlPer100Km, NUMBER_LOCALE)}/100km`
                  : UI.admin.refuelling.kmSinceLastUnavailable
              }
            />
          </dl>
        </CardBody>
      </Card>

      <RefuellingForm
        action={updateRefuellingAction.bind(null, id)}
        submitLabel={UI.common.save}
        context={{ vehicles, drivers, fuelTypes, gasStations, paymentMethods }}
        initial={{
          vehicleId: refuelling.vehicleId,
          driverId: refuelling.driverId,
          odometerKm: String(refuelling.odometerKm),
          liters: millilitersToInputValue(refuelling.litersMl),
          total: centsToInputValue(refuelling.totalCents),
          vatRate: refuelling.vatRate,
          fuelTypeId: refuelling.fuelTypeId ?? '',
          gasStationId: refuelling.gasStationId ?? '',
          paymentMethodId: refuelling.paymentMethodId ?? '',
          notes: refuelling.notes ?? '',
        }}
      />

      <DeleteRecord
        action={deleteRefuellingAction.bind(null, id)}
        name={`#${refuelling.refuelCode}`}
        deletability={{ canDelete: true, blockers: [], cascades: [] }}
      />
    </div>
  );
}
