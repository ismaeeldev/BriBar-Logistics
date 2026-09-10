/**
 * The quarterly VAT summary (ERP roadmap Phase 4, `06_Impuestos`). Admin-only.
 *
 * No new table, and no new repository either — `06_Impuestos` is a derived
 * view over the two invoice modules' own VAT columns (roadmap's own framing,
 * echoing `07_Inversiones`'s — ADR 0014), so this reads
 * `receivedInvoiceRepository`/`issuedInvoiceRepository` directly rather than
 * introducing a third repository with nothing of its own to store.
 */
import type { Actor } from '@/lib/auth/session';
import { forbidden } from '@/lib/errors/app-error';
import { issuedInvoiceRepository } from '@/modules/issued-invoices/repository/issued-invoice.repository';
import { receivedInvoiceRepository } from '@/modules/received-invoices/repository/received-invoice.repository';
import { Role } from '@/modules/services/domain/service-status';
import { fiscalPeriodFromParts } from '@/modules/shared/domain/fiscal-period';

/** One quarter's VAT position. */
export interface QuarterlyTaxSummary {
  year: number;
  quarter: number;
  /** "IVA repercutido" - VAT charged on issued invoices. */
  vatOutputCents: number;
  /** "IVA soportado" - VAT paid on received invoices. */
  vatInputCents: number;
  /** `vatOutputCents - vatInputCents`. Positive: owed to the tax office
   * ("a ingresar"). Negative: a refund is due ("a devolver"). */
  balanceCents: number;
}

function assertAdmin(actor: Actor): void {
  if (actor.role !== Role.ADMIN) throw forbidden();
}

export const taxService = {
  async quarterlySummary(actor: Actor): Promise<QuarterlyTaxSummary[]> {
    assertAdmin(actor);

    const [received, issued] = await Promise.all([
      receivedInvoiceRepository.allForTaxSummary(),
      issuedInvoiceRepository.allForTaxSummary(),
    ]);

    const byPeriod = new Map<
      string,
      { year: number; quarter: number; vatOutputCents: number; vatInputCents: number }
    >();

    function bucket(date: Date): { year: number; quarter: number; vatOutputCents: number; vatInputCents: number } {
      // UTC accessors, the same discipline `src/lib/time/time-of-day.ts`
      // documents for a `@db.Date` value: the server's local offset must
      // never shift which calendar day - and here, which quarter - a date
      // lands on.
      const period = fiscalPeriodFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1);
      const key = `${period.year}-Q${period.quarter}`;
      let row = byPeriod.get(key);
      if (!row) {
        row = { year: period.year, quarter: period.quarter, vatOutputCents: 0, vatInputCents: 0 };
        byPeriod.set(key, row);
      }
      return row;
    }

    for (const invoice of received) {
      bucket(invoice.invoiceDate).vatInputCents += invoice.vatCents;
    }
    for (const invoice of issued) {
      bucket(invoice.invoiceDate).vatOutputCents += invoice.vatCents;
    }

    return Array.from(byPeriod.values())
      .map((row) => ({ ...row, balanceCents: row.vatOutputCents - row.vatInputCents }))
      .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.quarter - a.quarter));
  },
} as const;
