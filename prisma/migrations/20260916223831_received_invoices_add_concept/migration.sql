-- Client change request 2026-09-17: `ReceivedInvoice.concept`, the
-- human-readable line transcribed from the supplier's own document.
-- Added nullable first so existing rows can be backfilled, then made
-- required — matching the `services_base_formula` backfill discipline
-- (ADR 0015).

-- AlterTable (nullable)
ALTER TABLE "received_invoices" ADD COLUMN "concept" VARCHAR(200);

-- Backfill: reuse the invoice's expense category name as a reasonable
-- concept for rows recorded before this field existed.
UPDATE "received_invoices" ri
SET "concept" = ec."name"
FROM "expense_categories" ec
WHERE ri."category_id" = ec."id" AND ri."concept" IS NULL;

-- Belt-and-braces default for any row whose category vanished by the time
-- this runs (should not happen — categories are Restrict-protected — but a
-- NOT NULL column must never depend on that holding).
UPDATE "received_invoices" SET "concept" = '(sin concepto)' WHERE "concept" IS NULL;

-- AlterTable (now required)
ALTER TABLE "received_invoices" ALTER COLUMN "concept" SET NOT NULL;
