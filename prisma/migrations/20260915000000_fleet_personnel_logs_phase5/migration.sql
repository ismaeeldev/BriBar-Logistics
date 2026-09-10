-- ===========================================================================
-- ERP roadmap Phase 5: daily real km, personnel cost, and maintenance logs.
-- Three independent tables - see the section comment in schema.prisma for
-- why they are not one generic "log" table.
-- ===========================================================================

-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'DAILY_KM_LOG';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'PERSONNEL_COST';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'MAINTENANCE_RECORD';
ALTER TYPE "lookup_kind" ADD VALUE IF NOT EXISTS 'MAINTENANCE_TYPE';

-- The maintenance-record sequence (ADR 0003's pattern, generalised).
CREATE SEQUENCE "maintenance_code_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- CreateTable
CREATE TABLE "daily_km_logs" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "route_id" UUID,
    "driver_id" UUID,
    "date" DATE NOT NULL,
    "actual_km" INTEGER NOT NULL,
    "worked_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_km_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_costs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "base_cents" INTEGER NOT NULL,
    "overtime_cents" INTEGER,
    "allowances_cents" INTEGER,
    "other_cents" INTEGER,
    "total_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "personnel_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "maintenance_code" VARCHAR(32) NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "maintenance_type_id" UUID NOT NULL,
    "performed_date" DATE NOT NULL,
    "performed_km" INTEGER,
    "next_due_km" INTEGER,
    "next_due_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_km_logs_vehicle_id_date_key" ON "daily_km_logs"("vehicle_id", "date");

-- CreateIndex
CREATE INDEX "daily_km_logs_date_idx" ON "daily_km_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_costs_user_id_year_month_key" ON "personnel_costs"("user_id", "year", "month");

-- CreateIndex
CREATE INDEX "personnel_costs_year_month_idx" ON "personnel_costs"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_records_maintenance_code_key" ON "maintenance_records"("maintenance_code");

-- CreateIndex
CREATE INDEX "maintenance_records_vehicle_type_date_idx" ON "maintenance_records"("vehicle_id", "maintenance_type_id", "performed_date" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_next_due_date_idx" ON "maintenance_records"("next_due_date");

-- AddForeignKey
ALTER TABLE "daily_km_logs" ADD CONSTRAINT "daily_km_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_km_logs" ADD CONSTRAINT "daily_km_logs_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_km_logs" ADD CONSTRAINT "daily_km_logs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_costs" ADD CONSTRAINT "personnel_costs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_maintenance_type_id_fkey" FOREIGN KEY ("maintenance_type_id") REFERENCES "lookup_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A reading cannot be negative.
ALTER TABLE "daily_km_logs" ADD CONSTRAINT "daily_km_logs_km_non_negative" CHECK (
  "actual_km" >= 0
);

ALTER TABLE "daily_km_logs" ADD CONSTRAINT "daily_km_logs_worked_minutes_non_negative" CHECK (
  "worked_minutes" IS NULL OR "worked_minutes" >= 0
);

-- No amount on a personnel cost row can be negative.
ALTER TABLE "personnel_costs" ADD CONSTRAINT "personnel_costs_amounts_non_negative" CHECK (
  "base_cents" >= 0
  AND ("overtime_cents" IS NULL OR "overtime_cents" >= 0)
  AND ("allowances_cents" IS NULL OR "allowances_cents" >= 0)
  AND ("other_cents" IS NULL OR "other_cents" >= 0)
);

-- A calendar month.
ALTER TABLE "personnel_costs" ADD CONSTRAINT "personnel_costs_month_range" CHECK (
  "month" BETWEEN 1 AND 12
);

-- `total_cents` is always the sum of the four component amounts - plain
-- addition, no rounding ambiguity (unlike `dailyFixedCostCents`, which is
-- deliberately not a column - see the model's doc comment in schema.prisma).
ALTER TABLE "personnel_costs" ADD CONSTRAINT "personnel_costs_total_formula" CHECK (
  "total_cents" = "base_cents"
    + COALESCE("overtime_cents", 0)
    + COALESCE("allowances_cents", 0)
    + COALESCE("other_cents", 0)
);

-- Odometer readings cannot be negative.
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_km_non_negative" CHECK (
  ("performed_km" IS NULL OR "performed_km" >= 0)
  AND ("next_due_km" IS NULL OR "next_due_km" >= 0)
);
