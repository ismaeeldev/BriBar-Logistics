-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "service_status" AS ENUM ('PENDING_APPROVAL', 'APPROVED');

-- CreateEnum
CREATE TYPE "audit_entity_type" AS ENUM ('SERVICE', 'USER', 'VEHICLE', 'ROUTE', 'DRIVER_ROUTE');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'APPROVE', 'ACTIVATE', 'DEACTIVATE', 'ASSIGN_ROUTES');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "login_identifier" VARCHAR(64) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "role" NOT NULL,
    "default_vehicle_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "registration_plate" VARCHAR(32) NOT NULL,
    "reference_name" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "origin" VARCHAR(160) NOT NULL,
    "destination" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_routes" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "service_code" VARCHAR(32) NOT NULL,
    "service_date" DATE NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "origin_snapshot" VARCHAR(160) NOT NULL,
    "destination_snapshot" VARCHAR(160) NOT NULL,
    "start_dashboard_km" INTEGER NOT NULL,
    "start_base_km" INTEGER NOT NULL,
    "end_base_km" INTEGER NOT NULL,
    "end_dashboard_km" INTEGER NOT NULL,
    "actual_km" INTEGER NOT NULL,
    "service_km" INTEGER NOT NULL,
    "departure_time" TIME(0) NOT NULL,
    "arrival_time" TIME(0) NOT NULL,
    "sites" TEXT,
    "observations" TEXT,
    "status" "service_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_user_id" UUID,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_status_history" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "from_status" "service_status",
    "to_status" "service_status" NOT NULL,
    "changed_by_user_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" "audit_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_identifier_key" ON "users"("login_identifier");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_default_vehicle_id_idx" ON "users"("default_vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_plate_key" ON "vehicles"("registration_plate");

-- CreateIndex
CREATE INDEX "vehicles_is_active_idx" ON "vehicles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "routes_code_key" ON "routes"("code");

-- CreateIndex
CREATE INDEX "routes_is_active_idx" ON "routes"("is_active");

-- CreateIndex
CREATE INDEX "driver_routes_driver_id_idx" ON "driver_routes"("driver_id");

-- CreateIndex
CREATE INDEX "driver_routes_route_id_idx" ON "driver_routes"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_routes_driver_id_route_id_key" ON "driver_routes"("driver_id", "route_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_service_code_key" ON "services"("service_code");

-- CreateIndex
CREATE INDEX "services_service_date_idx" ON "services"("service_date");

-- CreateIndex
CREATE INDEX "services_driver_id_idx" ON "services"("driver_id");

-- CreateIndex
CREATE INDEX "services_vehicle_id_idx" ON "services"("vehicle_id");

-- CreateIndex
CREATE INDEX "services_route_id_idx" ON "services"("route_id");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_created_at_idx" ON "services"("created_at");

-- CreateIndex
CREATE INDEX "services_status_service_date_idx" ON "services"("status", "service_date" DESC);

-- CreateIndex
CREATE INDEX "services_driver_id_service_date_idx" ON "services"("driver_id", "service_date" DESC);

-- CreateIndex
CREATE INDEX "service_status_history_service_id_changed_at_idx" ON "service_status_history"("service_id", "changed_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_vehicle_id_fkey" FOREIGN KEY ("default_vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_routes" ADD CONSTRAINT "driver_routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_routes" ADD CONSTRAINT "driver_routes_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_status_history" ADD CONSTRAINT "service_status_history_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_status_history" ADD CONSTRAINT "service_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- Hand-written additions.
--
-- Everything above this line was generated from schema.prisma. Everything
-- below expresses an SRS rule that the Prisma schema language cannot state:
-- a partial unique index, a set of CHECK constraints, and a sequence.
--
-- These are defence in depth, not the primary control. Zod rejects bad input
-- at the API boundary and the service layer enforces authorisation; these
-- constraints guarantee that no future code path - a migration script, a
-- manual psql session, a bug in a repository - can leave the database in a
-- state the business rules forbid.
--
-- If you regenerate this migration, re-apply this block.
-- ===========================================================================

-- SRS 12.6, 19.6: "Application/database logic must prevent more than one
-- default route for the same Driver."
--
-- A partial unique index is the only way to say "at most one row per driver
-- WHERE is_default". @@unique cannot carry the WHERE clause, and a plain
-- unique on (driver_id, is_default) would wrongly cap a driver at one
-- non-default route as well.
CREATE UNIQUE INDEX "driver_routes_one_default_per_driver"
  ON "driver_routes" ("driver_id")
  WHERE "is_default";

-- SRS 19.1, 23.4: the human-visible Service ID must be unique under
-- concurrent submission.
--
-- nextval() is atomic, never blocks, and is explicitly not rolled back by a
-- failed transaction - which is what makes it safe here. A per-day counter
-- read from the services table would race between the read and the insert.
-- Gaps after a rolled-back submission are the accepted cost; they are
-- cosmetic, whereas a collision is data loss.
CREATE SEQUENCE "service_code_seq"
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- SRS 10.3: mileage cannot be negative.
ALTER TABLE "services" ADD CONSTRAINT "services_mileage_non_negative" CHECK (
  "start_dashboard_km" >= 0
  AND "start_base_km"  >= 0
  AND "end_base_km"    >= 0
  AND "end_dashboard_km" >= 0
);

-- SRS 10.3: the odometer sequence.
--   Start Dashboard KM <= Start Base KM <= End Base KM <= End Dashboard KM
-- Non-strict, because a zero-distance service is operationally valid
-- (SRS 26.3 lists it as a case to test, not to reject).
ALTER TABLE "services" ADD CONSTRAINT "services_mileage_sequence" CHECK (
  "start_dashboard_km" <= "start_base_km"
  AND "start_base_km"  <= "end_base_km"
  AND "end_base_km"    <= "end_dashboard_km"
);

-- SRS 10.1, 10.2: the stored calculations must equal their formulas.
--
-- This is what makes it safe to store actual_km and service_km rather than
-- deriving them on read. A write that supplies a browser-supplied total
-- instead of the server's own calculation is rejected by the database, so
-- SRS 22.4 holds even against a code path that forgets to recalculate.
ALTER TABLE "services" ADD CONSTRAINT "services_actual_km_formula" CHECK (
  "actual_km" = "end_dashboard_km" - "start_dashboard_km"
);

ALTER TABLE "services" ADD CONSTRAINT "services_service_km_formula" CHECK (
  "service_km" = "end_base_km" - "start_base_km"
);

-- SRS 10.3: "Service Km cannot exceed Actual Km." Implied by the sequence
-- constraint above, and stated separately because the SRS states it
-- separately.
ALTER TABLE "services" ADD CONSTRAINT "services_service_km_within_actual" CHECK (
  "service_km" <= "actual_km"
);

-- SRS 11.3, 19.7: approval metadata is set together or not at all.
--
-- Without this, a partial write could produce an APPROVED service with no
-- approver - a record that looks signed off but names nobody, which is
-- precisely the traceability failure SRS 21.1 exists to prevent.
ALTER TABLE "services" ADD CONSTRAINT "services_approval_metadata_consistent" CHECK (
  (
    "status" = 'APPROVED'
    AND "approved_at" IS NOT NULL
    AND "approved_by_user_id" IS NOT NULL
  )
  OR (
    "status" = 'PENDING_APPROVAL'
    AND "approved_at" IS NULL
    AND "approved_by_user_id" IS NULL
  )
);

-- SRS 14.5, 21.4: a service always carries its own origin/destination
-- snapshot, so editing route master data cannot rewrite history.
ALTER TABLE "services" ADD CONSTRAINT "services_snapshots_present" CHECK (
  length(btrim("origin_snapshot")) > 0
  AND length(btrim("destination_snapshot")) > 0
);
