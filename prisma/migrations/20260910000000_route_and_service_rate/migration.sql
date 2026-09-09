-- ===========================================================================
-- Client change request 2026-09-09 (item #4) / ERP roadmap Phase 0.
--
-- The first slice of the billing model: a route may carry a default rate, and
-- every service snapshots it at creation the same way it already snapshots
-- origin/destination (14.5). An administrator may see and change the rate on
-- an individual service - typically while reviewing it before approval -
-- without touching the route's default. Both are admin-only: a driver's
-- request schemas and presenters never carry either column.
--
-- Stored as whole EUR cents (Int), never a float - see src/lib/money/money.ts.
-- ===========================================================================

ALTER TABLE "routes" ADD COLUMN "default_rate_cents" INTEGER;
ALTER TABLE "services" ADD COLUMN "rate_cents" INTEGER;

ALTER TABLE "routes" ADD CONSTRAINT "routes_default_rate_non_negative" CHECK (
  "default_rate_cents" IS NULL OR "default_rate_cents" >= 0
);

ALTER TABLE "services" ADD CONSTRAINT "services_rate_non_negative" CHECK (
  "rate_cents" IS NULL OR "rate_cents" >= 0
);
