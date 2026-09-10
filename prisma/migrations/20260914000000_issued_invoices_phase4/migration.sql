-- ===========================================================================
-- ERP roadmap Phase 4: Issued invoices, the service supplement/base-amount
-- fields that feed them, and the Route -> Client link (roadmap §6 B4,
-- resolved as "Contrato = Route") that says which client a service bills to.
-- ===========================================================================

-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'ISSUED_INVOICE';

-- AlterTable: routes -> client
ALTER TABLE "routes" ADD COLUMN "client_id" UUID;

-- AlterTable: services -> supplement, base, issued-invoice link
ALTER TABLE "services" ADD COLUMN "supplement_cents" INTEGER;
ALTER TABLE "services" ADD COLUMN "supplement_type_id" UUID;
ALTER TABLE "services" ADD COLUMN "base_cents" INTEGER;
ALTER TABLE "services" ADD COLUMN "issued_invoice_id" UUID;

-- The issued-invoice sequence (ADR 0003's pattern, generalised).
CREATE SEQUENCE "issued_invoice_code_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- CreateTable
CREATE TABLE "issued_invoices" (
    "id" UUID NOT NULL,
    "invoice_code" VARCHAR(32) NOT NULL,
    "client_id" UUID NOT NULL,
    "invoice_date" DATE NOT NULL,
    "base_cents" INTEGER NOT NULL,
    "vat_rate" "vat_rate" NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "state_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "issued_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issued_invoices_invoice_code_key" ON "issued_invoices"("invoice_code");

-- CreateIndex
CREATE INDEX "issued_invoices_invoice_date_idx" ON "issued_invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "issued_invoices_client_id_idx" ON "issued_invoices"("client_id");

-- CreateIndex
CREATE INDEX "routes_client_id_idx" ON "routes"("client_id");

-- CreateIndex
CREATE INDEX "services_issued_invoice_id_idx" ON "services"("issued_invoice_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_supplement_type_id_fkey" FOREIGN KEY ("supplement_type_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey. SetNull, not Restrict - see the doc comment on
-- `Service.issuedInvoiceId` in schema.prisma: deleting an issued invoice
-- un-bills the services it grouped rather than being blocked by them.
ALTER TABLE "services" ADD CONSTRAINT "services_issued_invoice_id_fkey" FOREIGN KEY ("issued_invoice_id") REFERENCES "issued_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every row predates the `base_cents` column, so it is NULL even
-- where `rate_cents` is already set. `supplement_cents` is new too and is
-- null for every existing row, so this is exactly the `services_base_formula`
-- formula below with that term dropped. Without this, adding the CHECK
-- constraint immediately below would fail the migration on the first
-- pre-existing service that already has a rate.
UPDATE "services" SET "base_cents" = "rate_cents" WHERE "rate_cents" IS NOT NULL;

-- A supplement cannot be negative.
ALTER TABLE "services" ADD CONSTRAINT "services_supplement_non_negative" CHECK (
  "supplement_cents" IS NULL OR "supplement_cents" >= 0
);

-- "Base imponible = tarifa + suplemento" - and a service with no rate has no
-- base at all, so it cannot be invoiced (services_issued_invoice_requires_billable,
-- below, is what actually enforces "no rate -> not billable"; this constraint
-- only keeps the stored base_cents value itself from drifting off that formula).
ALTER TABLE "services" ADD CONSTRAINT "services_base_formula" CHECK (
  ("rate_cents" IS NULL AND "base_cents" IS NULL)
  OR
  ("rate_cents" IS NOT NULL AND "base_cents" = "rate_cents" + COALESCE("supplement_cents", 0))
);

-- A service can only be linked to an issued invoice once it is Approved and
-- has a base amount - grouping a Pending or unpriced service into an invoice
-- would bill something that was never signed off, or bill nothing at all.
ALTER TABLE "services" ADD CONSTRAINT "services_issued_invoice_requires_billable" CHECK (
  "issued_invoice_id" IS NULL
  OR ("status" = 'APPROVED' AND "base_cents" IS NOT NULL)
);

-- A taxable base cannot be negative.
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_base_non_negative" CHECK (
  "base_cents" >= 0
);

-- Same guarantee as `received_invoices_vat_sum` / `refuellings_base_vat_sum`
-- (ADR 0013/0014): the stored split must always reconstruct the stored total.
ALTER TABLE "issued_invoices" ADD CONSTRAINT "issued_invoices_vat_sum" CHECK (
  "base_cents" + "vat_cents" = "total_cents"
);
