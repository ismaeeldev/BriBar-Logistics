-- ===========================================================================
-- ERP roadmap Phase 2: the Refuelling module.
--
-- The first module built on the Phase 1 finance core (VAT, the document-
-- sequence pattern) and the first real consumer of two Phase 1 additions
-- that had no caller yet: `formatDocumentCode` (refuel codes) and the
-- `LookupItem` table gets a new kind (gas stations) rather than a new table.
-- ===========================================================================

-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'REFUELLING';
ALTER TYPE "lookup_kind" ADD VALUE IF NOT EXISTS 'GAS_STATION';

-- CreateEnum
CREATE TYPE "vat_rate" AS ENUM ('STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT');

-- The refuel-code sequence (ADR 0003's pattern, generalised in Phase 1's
-- `formatDocumentCode`). Same shape as `service_code_seq`: atomic, never
-- rolled back by a failed transaction, so two concurrent submissions can
-- never collide. Gaps after a rolled-back submission are the accepted cost.
CREATE SEQUENCE "refuelling_code_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- CreateTable
CREATE TABLE "refuellings" (
    "id" UUID NOT NULL,
    "refuel_code" VARCHAR(32) NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "refuel_date" DATE NOT NULL,
    "odometer_km" INTEGER NOT NULL,
    "liters_ml" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "vat_rate" "vat_rate" NOT NULL,
    "base_cents" INTEGER NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "fuel_type_id" UUID,
    "gas_station_id" UUID,
    "payment_method_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refuellings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refuellings_refuel_code_key" ON "refuellings"("refuel_code");

-- CreateIndex
CREATE INDEX "refuellings_vehicle_id_refuel_date_idx" ON "refuellings"("vehicle_id", "refuel_date");

-- CreateIndex
CREATE INDEX "refuellings_refuel_date_idx" ON "refuellings"("refuel_date");

-- AddForeignKey
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_gas_station_id_fkey" FOREIGN KEY ("gas_station_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A refuel cannot have a negative odometer reading.
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_odometer_non_negative" CHECK (
  "odometer_km" >= 0
);

-- Zero litres is not a fuel purchase.
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_liters_positive" CHECK (
  "liters_ml" > 0
);

-- A price cannot be negative (free fuel, if it ever happens, is zero).
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_total_non_negative" CHECK (
  "total_cents" >= 0
);

-- The stored base/VAT split must always reconstruct the stored total exactly
-- - the same "calculated column can never drift from its inputs" guarantee
-- `services_actual_km_formula` gives the mileage columns (SRS 10.1's
-- rationale, carried into a module the SRS does not cover).
ALTER TABLE "refuellings" ADD CONSTRAINT "refuellings_base_vat_sum" CHECK (
  "base_cents" + "vat_cents" = "total_cents"
);
