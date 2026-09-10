-- ===========================================================================
-- ERP roadmap Phase 3: Received invoices, and the Supplier/Expense category
-- master data ADR 0012 deferred until this module needed them.
-- ===========================================================================

-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'SUPPLIER';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'EXPENSE_CATEGORY';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'RECEIVED_INVOICE';
ALTER TYPE "lookup_kind" ADD VALUE IF NOT EXISTS 'INVOICE_STATE';

-- CreateEnum
CREATE TYPE "expense_type" AS ENUM ('OPERATION', 'INVESTMENT', 'NON_OPERATING');

-- The received-invoice sequence (ADR 0003's pattern, generalised - see
-- `refuelling_code_seq` for the same reasoning).
CREATE SEQUENCE "received_invoice_code_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tax_id" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "expense_type" "expense_type" NOT NULL,
    "default_vat_rate" "vat_rate" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_invoices" (
    "id" UUID NOT NULL,
    "invoice_code" VARCHAR(32) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "invoice_date" DATE NOT NULL,
    "base_cents" INTEGER NOT NULL,
    "vat_rate" "vat_rate" NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "state_id" UUID,
    "payment_method_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "received_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");

-- CreateIndex
CREATE INDEX "expense_categories_is_active_idx" ON "expense_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "received_invoices_invoice_code_key" ON "received_invoices"("invoice_code");

-- CreateIndex
CREATE INDEX "received_invoices_invoice_date_idx" ON "received_invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "received_invoices_vehicle_id_idx" ON "received_invoices"("vehicle_id");

-- CreateIndex
CREATE INDEX "received_invoices_category_id_idx" ON "received_invoices"("category_id");

-- AddForeignKey
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A taxable base cannot be negative.
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_base_non_negative" CHECK (
  "base_cents" >= 0
);

-- The stored base/VAT split must always reconstruct the stored total exactly
-- - same guarantee as `refuellings_base_vat_sum` (ADR 0013), the direction
-- of the calculation just runs the other way (base -> total here, rather
-- than total -> base).
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_vat_sum" CHECK (
  "base_cents" + "vat_cents" = "total_cents"
);
