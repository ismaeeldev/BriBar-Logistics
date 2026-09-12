/**
 * The analytics period filter (ERP roadmap Phase 6).
 *
 * The dashboard sheets pivot on year and (optionally) month; this is that
 * filter, parsed from the `/admin/analytics` query string. Both parts are
 * optional — absent means "all time", the natural default for a
 * whole-history view. No custom date ranges: the client's own sheets filter
 * by calendar period, not arbitrary spans.
 *
 * A malformed query string (`?year=abc`, `?month=99`) degrades to "all
 * time" rather than throwing — a bookmarked or hand-edited URL must not 500
 * the page. `.catch(undefined)` turns any parse failure on a part into
 * "not filtered".
 */
import { z } from 'zod';

import { optionalUuidSchema } from '@/modules/shared/schemas/common';

const yearSchema = z
  .preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(2000).max(2100).optional(),
  )
  .catch(undefined);

const monthSchema = z
  .preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(1).max(12).optional(),
  )
  .catch(undefined);

export const analyticsFilterSchema = z.object({
  year: yearSchema,
  /** Only meaningful alongside `year`; ignored on its own. */
  month: monthSchema,
  /** Absent means "Todos" - every vehicle (client decision 2026-09-13). */
  vehicleId: optionalUuidSchema.catch(undefined),
});

export type AnalyticsFilter = z.output<typeof analyticsFilterSchema>;
