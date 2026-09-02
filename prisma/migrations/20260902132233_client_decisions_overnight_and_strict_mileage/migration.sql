-- AlterTable
ALTER TABLE "services" ADD COLUMN     "ends_next_day" BOOLEAN NOT NULL DEFAULT false;

-- ===========================================================================
-- Hand-written additions.
--
-- Three client decisions recorded in docs/open-questions.md, applied to the
-- constraints that enforce them. As in the initial migration, everything below
-- this line expresses a rule the Prisma schema language cannot state.
-- ===========================================================================

-- Decision #4: zero-distance services are not acceptable.
--
-- SRS 10.3 states the odometer chain as non-strict throughout. One link is now
-- strict:
--
--     start_dashboard <= start_base < end_base <= end_dashboard
--                                   ^ strict
--
-- Only that link. Tightening the outer two would reject a truck that begins
-- the day already parked at the loading base, where start_dashboard
-- legitimately equals start_base.
--
-- Requiring end_base > start_base gives service_km > 0 directly, and
-- actual_km >= service_km follows from the outer links - so actual_km > 0
-- comes for free from a single comparison.
ALTER TABLE "services" DROP CONSTRAINT "services_mileage_sequence";

ALTER TABLE "services" ADD CONSTRAINT "services_mileage_sequence" CHECK (
  "start_dashboard_km" <= "start_base_km"
  AND "start_base_km"  <  "end_base_km"
  AND "end_base_km"    <= "end_dashboard_km"
);

-- Decision #3: reject a same-day service whose arrival precedes its departure.
--
-- A service runs for more than zero and less than twenty-four hours. Against
-- the ends_next_day flag that reduces to one comparison each way:
--
--   ends_next_day = false   arrival must be strictly after  departure
--   ends_next_day = true    arrival must be strictly before departure
--
-- The second is not arbitrary: an overnight service arriving at or after its
-- departure time ran for 24 hours or more, which is a data-entry error of a
-- different kind rather than a route sheet.
ALTER TABLE "services" ADD CONSTRAINT "services_times_consistent" CHECK (
  ("ends_next_day" = false AND "arrival_time" > "departure_time")
  OR
  ("ends_next_day" = true  AND "arrival_time" < "departure_time")
);

-- Decision #2: Service IDs continue the sequence already used in the client's
-- "01Servicios" register, as plain decimal numbers with no prefix or date.
--
-- The sequence still starts at 1 here, because the highest number currently in
-- use is not known at migration time and hard-coding a guess would be worse
-- than an explicit deployment step. Before go-live, run:
--
--     pnpm db:set-service-start <highest existing number>
--
-- which calls setval() and refuses to move the sequence backwards. Skipping it
-- means the application re-issues IDs the client has already printed on
-- paperwork, so the seed script warns when the sequence is still at its
-- initial value.
COMMENT ON SEQUENCE "service_code_seq" IS
  'Human-visible Service ID. Continues the numbering from the client''s 01Servicios register - advance with setval() before go-live.';
