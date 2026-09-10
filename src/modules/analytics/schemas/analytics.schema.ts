/**
 * The analytics period filter (ERP roadmap Phase 6).
 *
 * The dashboard sheets pivot on year and (optionally) month; this is that
 * filter, parsed from the `/admin/analytics` query string. Both parts are
 * optional — absent means "all time", the natural default for a
 * whole-history view. No custom date ranges: the client's own sheets filter
 * by calendar period, not arbitrary spans.
 */
import { z } from 'zod';

const yearSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().int().min(2000).max(2100).optional(),
);

const monthSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().int().min(1).max(12).optional(),
);

export const analyticsFilterSchema = z.object({
  year: yearSchema,
  /** Only meaningful alongside `year`; ignored on its own. */
  month: monthSchema,
});

export type AnalyticsFilter = z.output<typeof analyticsFilterSchema>;
