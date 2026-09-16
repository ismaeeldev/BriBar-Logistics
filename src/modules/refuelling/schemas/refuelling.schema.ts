/**
 * Refuelling schemas (ERP roadmap Phase 2, `02Repostajes`).
 *
 * Admin-only for this pass — see the doc comment on `Refuelling` in
 * `schema.prisma` for why — so there is one schema, not the driver/admin
 * split `createServiceSchema`/`adminCreateServiceSchema` use: every caller
 * already reaches this through an admin-only route.
 *
 * `refuelCode`, `refuelDate`, `baseCents` and `vatCents` have no field here
 * at all, the same "never trust the client for a server-owned value"
 * discipline `serviceCode`/`serviceDate`/`actualKm`/`serviceKm` follow
 * (CLAUDE.md) — they are allocated and calculated in `refuelling.service.ts`.
 */
import { z } from 'zod';

import { FIELD_LABELS } from '@/lib/i18n/messages';
import {
  litersSchema,
  odometerKmSchema,
  optionalText,
  requiredMoneySchema,
  uuidSchema,
  vatRateSchema,
} from '@/modules/shared/schemas/common';

export const createRefuellingSchema = z.strictObject({
  vehicleId: uuidSchema,
  driverId: uuidSchema,
  odometerKm: odometerKmSchema,
  liters: litersSchema,
  total: requiredMoneySchema,
  vatRate: vatRateSchema.default('STANDARD'),
  // Mandatory (client decision 2026-09-13): fuel type and gas station are
  // needed for reporting, not fill-in-later categorisation. The
  // `fuelType`/`gasStation` columns stay nullable in the database —
  // existing historical rows may still be blank — this only closes the gap
  // for new submissions. Payment method was dropped from this form entirely
  // (client change request 2026-09-17, superseding the earlier decision to
  // require it) — see `docs/adr/0013-refuelling-module.md`.
  fuelTypeId: uuidSchema,
  gasStationId: uuidSchema,
  notes: optionalText(FIELD_LABELS.observations),
});

export type CreateRefuellingInput = z.output<typeof createRefuellingSchema>;

export const updateRefuellingSchema = createRefuellingSchema.partial();

export type UpdateRefuellingInput = z.output<typeof updateRefuellingSchema>;
