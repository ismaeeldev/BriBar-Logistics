-- ===========================================================================
-- ERP roadmap Phase 1: finance-core master-data extensions.
--
-- Three new tables - Clients, a generic simple-lookup list (fuel types,
-- payment methods, supplement types, end clients), and the single-row
-- operational-defaults config - plus three new audit entity types for them.
-- None of the new tables is referenced by `services` yet: which record a
-- service bills to, and which lookup list it draws a supplement type from,
-- are decisions for the phases that actually consume them (roadmap §4,
-- Phase 4 for Client, the supplement field itself for SUPPLEMENT_TYPE).
-- ===========================================================================

-- AlterEnum
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'CLIENT';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'LOOKUP_ITEM';
ALTER TYPE "audit_entity_type" ADD VALUE IF NOT EXISTS 'APP_CONFIG';

-- CreateEnum
CREATE TYPE "lookup_kind" AS ENUM ('FUEL_TYPE', 'PAYMENT_METHOD', 'SUPPLEMENT_TYPE', 'END_CLIENT');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "tax_id" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_items" (
    "id" UUID NOT NULL,
    "kind" "lookup_kind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lookup_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" VARCHAR(16) NOT NULL,
    "oil_change_interval_km" INTEGER NOT NULL DEFAULT 15000,
    "default_consumption_ml_per_100km" INTEGER NOT NULL DEFAULT 11000,
    "default_fuel_price_cents_per_liter" INTEGER NOT NULL DEFAULT 152,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_items_kind_name_key" ON "lookup_items"("kind", "name");

-- CreateIndex
CREATE INDEX "lookup_items_kind_is_active_idx" ON "lookup_items"("kind", "is_active");

-- A settings row cannot describe a negative interval, consumption or price -
-- the same non-negative backstop the rate columns already have (see
-- `routes_default_rate_non_negative` / `services_rate_non_negative`), applied
-- here as one constraint across all three columns since they are always
-- written together by the one config form.
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_positive_defaults" CHECK (
  "oil_change_interval_km" > 0
  AND "default_consumption_ml_per_100km" > 0
  AND "default_fuel_price_cents_per_liter" >= 0
);

-- Seeds the single settings row. `AppConfig.id` is a fixed application-known
-- value ("default"), not a generated one - see the doc comment on the model -
-- so the service layer can always `findUnique({ id: 'default' })` without a
-- "create if missing" branch. Safe to re-run: a second application of this
-- migration (there won't be one) would leave the existing row untouched.
INSERT INTO "app_config" (
  "id", "oil_change_interval_km", "default_consumption_ml_per_100km",
  "default_fuel_price_cents_per_liter", "updated_at"
) VALUES ('default', 15000, 11000, 152, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
