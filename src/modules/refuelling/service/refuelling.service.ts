/**
 * Refuelling administration (ERP roadmap Phase 2). Admin-only end to end —
 * see the doc comment on `Refuelling` in `schema.prisma`.
 */
import type { LookupKind, Prisma } from '@prisma/client';

import {
  AuditAction,
  AuditEntityType,
  diffForAudit,
  writeAudit,
} from '@/lib/audit/audit-service';
import type { Actor } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withTranslatedErrors } from '@/lib/db/with-translated-errors';
import { env } from '@/lib/env';
import { businessRuleViolation, forbidden, notFound } from '@/lib/errors/app-error';
import { ERRORS } from '@/lib/i18n/messages';
import { currentBusinessDate } from '@/lib/time/business-date';
import { formatDocumentCode } from '@/modules/shared/domain/document-sequence';
import { baseFromGross, type VatRate } from '@/modules/shared/domain/vat';
import type { Pagination } from '@/modules/shared/schemas/common';
import { lookupRepository } from '@/modules/lookup/repository/lookup.repository';
import { Role } from '@/modules/services/domain/service-status';
import { userRepository } from '@/modules/users/repository/user.repository';
import { vehicleRepository } from '@/modules/vehicles/repository/vehicle.repository';
import { consumptionMlPer100Km, kmSinceLast } from '../domain/consumption';
import {
  refuellingRepository,
  type RefuellingWithRelations,
} from '../repository/refuelling.repository';
import type { CreateRefuellingInput, UpdateRefuellingInput } from '../schemas/refuelling.schema';

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

/** The computed figures a detail view shows alongside the stored row. */
export interface RefuellingDetail {
  refuelling: RefuellingWithRelations;
  kmSinceLastRefuel: number | null;
  consumptionMlPer100Km: number | null;
}

async function assertActiveVehicle(vehicleId: string): Promise<void> {
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) throw notFound();
  if (!vehicle.isActive) throw businessRuleViolation(ERRORS.vehicleInactive);
}

async function assertActiveDriver(driverId: string): Promise<void> {
  const driver = await userRepository.findById(driverId);
  if (!driver) throw notFound();
  if (driver.role !== Role.DRIVER) throw businessRuleViolation(ERRORS.userNotDriver);
  if (!driver.isActive) throw businessRuleViolation(ERRORS.driverInactive);
}

/**
 * Confirms an optional lookup reference actually belongs to the kind it is
 * meant to — the FK alone cannot: `fuel_type_id`, `gas_station_id` and
 * `payment_method_id` all point at the same polymorphic `lookup_items`
 * table (see the doc comment on those relations in `schema.prisma`), so a
 * hand-crafted request could otherwise pass a payment method's id as the
 * fuel type and the database would accept it.
 */
async function assertLookupKind(id: string | undefined, kind: LookupKind): Promise<void> {
  if (id === undefined) return;
  const item = await lookupRepository.findById(kind, id);
  if (!item) throw businessRuleViolation(ERRORS.lookupKindMismatch);
}

/**
 * Splits a gross total into its base/VAT pair the one way that keeps
 * `refuellings_base_vat_sum` unconditionally true.
 *
 * `baseCents` comes from `baseFromGross` (the spreadsheet's own
 * `Base = Total/1.21`, generalised to all five rates); `vatCents` is then
 * `totalCents - baseCents` by definition, **not** a second call to
 * `applyVat(baseCents, rate).vatCents`. The two would usually agree, but
 * each rounds independently, and an input that lands exactly on a rounding
 * boundary could make them differ by a cent — which the CHECK constraint
 * would then reject on an entirely correct submission.
 */
function splitBaseAndVat(totalCents: number, vatRate: VatRate): { baseCents: number; vatCents: number } {
  const baseCents = baseFromGross(totalCents, vatRate);
  return { baseCents, vatCents: totalCents - baseCents };
}

export const refuellingService = {
  async listPage(
    actor: Actor,
    filters: { vehicleId?: string },
    pagination: Pagination,
  ): Promise<{ items: RefuellingWithRelations[]; total: number }> {
    assertAdmin(actor);
    return refuellingRepository.listPage(filters, pagination);
  },

  /**
   * The stored row plus the two figures the spreadsheet derives per line —
   * `kmSinceLastRefuel` and the consumption it implies — computed here
   * rather than stored (see the doc comment on `Refuelling` for why: a
   * stored value would be wrong the moment an out-of-order entry is
   * corrected, since it would still reflect whatever the chain looked like
   * at the time this row was written).
   */
  async getById(actor: Actor, id: string): Promise<RefuellingDetail> {
    assertAdmin(actor);
    const refuelling = await refuellingRepository.findById(id);
    if (!refuelling) throw notFound();

    const previous = await refuellingRepository.previousForVehicle(
      refuelling.vehicleId,
      refuelling.refuelDate,
      refuelling.id,
    );
    const km = kmSinceLast(refuelling.odometerKm, previous?.odometerKm ?? null);

    return {
      refuelling,
      kmSinceLastRefuel: km,
      consumptionMlPer100Km: consumptionMlPer100Km(refuelling.litersMl, km),
    };
  },

  async create(actor: Actor, input: CreateRefuellingInput): Promise<RefuellingWithRelations> {
    assertAdmin(actor);

    await assertActiveVehicle(input.vehicleId);
    await assertActiveDriver(input.driverId);
    await assertLookupKind(input.fuelTypeId, 'FUEL_TYPE');
    await assertLookupKind(input.gasStationId, 'GAS_STATION');
    await assertLookupKind(input.paymentMethodId, 'PAYMENT_METHOD');

    const { baseCents, vatCents } = splitBaseAndVat(input.total, input.vatRate);

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const sequence = await refuellingRepository.nextRefuelSequence(tx);

        const created = await refuellingRepository.create(
          {
            refuelCode: formatDocumentCode('R', 6, sequence),
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            // SRS 9.2's pattern, applied here too: the business date is
            // server-set, never client-supplied.
            refuelDate: currentBusinessDate(env.APP_TIMEZONE),
            odometerKm: input.odometerKm,
            litersMl: input.liters,
            totalCents: input.total,
            vatRate: input.vatRate,
            baseCents,
            vatCents,
            fuelTypeId: input.fuelTypeId ?? null,
            gasStationId: input.gasStationId ?? null,
            paymentMethodId: input.paymentMethodId ?? null,
            notes: input.notes ?? null,
          } satisfies Prisma.RefuellingUncheckedCreateInput,
          tx,
        );

        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.REFUELLING,
          entityId: created.id,
          action: AuditAction.CREATE,
          after: created,
        });

        return created;
      }),
    );
  },

  async update(
    actor: Actor,
    id: string,
    input: UpdateRefuellingInput,
  ): Promise<RefuellingWithRelations> {
    assertAdmin(actor);

    const existing = await refuellingRepository.findById(id);
    if (!existing) throw notFound();

    if (input.vehicleId !== undefined) await assertActiveVehicle(input.vehicleId);
    if (input.driverId !== undefined) await assertActiveDriver(input.driverId);
    await assertLookupKind(input.fuelTypeId, 'FUEL_TYPE');
    await assertLookupKind(input.gasStationId, 'GAS_STATION');
    await assertLookupKind(input.paymentMethodId, 'PAYMENT_METHOD');

    // The base/VAT split is recalculated whenever either input to it
    // changes, and left untouched otherwise — an edit to, say, the notes
    // field must not silently re-round a total that was not itself edited.
    const nextTotal = input.total ?? existing.totalCents;
    const nextRate = (input.vatRate ?? existing.vatRate) as VatRate;
    const recalculate = input.total !== undefined || input.vatRate !== undefined;
    const split = recalculate ? splitBaseAndVat(nextTotal, nextRate) : null;

    return withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        const updated = await refuellingRepository.update(
          id,
          {
            ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId }),
            ...(input.driverId === undefined ? {} : { driverId: input.driverId }),
            ...(input.odometerKm === undefined ? {} : { odometerKm: input.odometerKm }),
            ...(input.liters === undefined ? {} : { litersMl: input.liters }),
            ...(input.total === undefined ? {} : { totalCents: input.total }),
            ...(input.vatRate === undefined ? {} : { vatRate: input.vatRate }),
            ...(split ? { baseCents: split.baseCents, vatCents: split.vatCents } : {}),
            ...(input.fuelTypeId === undefined ? {} : { fuelTypeId: input.fuelTypeId ?? null }),
            ...(input.gasStationId === undefined
              ? {}
              : { gasStationId: input.gasStationId ?? null }),
            ...(input.paymentMethodId === undefined
              ? {}
              : { paymentMethodId: input.paymentMethodId ?? null }),
            ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
          },
          tx,
        );

        const changes = diffForAudit(
          existing as unknown as Record<string, unknown>,
          input as Record<string, unknown>,
        );

        if (changes) {
          await writeAudit(tx, {
            actorUserId: actor.userId,
            entityType: AuditEntityType.REFUELLING,
            entityId: id,
            action: AuditAction.UPDATE,
            before: changes.before,
            after: changes.after,
          });
        }

        return updated;
      }),
    );
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertAdmin(actor);

    const existing = await refuellingRepository.findById(id);
    if (!existing) throw notFound();

    await withTranslatedErrors(() =>
      prisma.$transaction(async (tx) => {
        await writeAudit(tx, {
          actorUserId: actor.userId,
          entityType: AuditEntityType.REFUELLING,
          entityId: id,
          action: AuditAction.DELETE,
          before: existing,
        });

        await refuellingRepository.delete(id, tx);
      }),
    );
  },
} as const;
