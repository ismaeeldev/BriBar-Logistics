-- ===========================================================================
-- Change request 2026-09-09: accept the arrival time on a next-day service.
--
-- Client decision #3 required a flagged-overnight service to arrive *before*
-- it departed, so it could not silently span 24 hours or more
-- (`ends_next_day = true AND arrival_time < departure_time`). Drivers found
-- that confusing: ticking "llega al día siguiente" and entering a plausible
-- clock time was rejected, and in some code paths the rejection surfaced as an
-- error page rather than a field message.
--
-- The rule is relaxed: when `ends_next_day` is true, any valid arrival time is
-- accepted. The same-day rule is unchanged — a same-day service must still
-- move forwards on the clock, which is the transposition-typo guard #3 asked
-- for. Enforced in the domain layer, the Zod schema, and here.
--
-- No column change; this is a constraint swap only, so there is no matching
-- edit in schema.prisma (the CHECK cannot be expressed there anyway).
-- ===========================================================================

ALTER TABLE "services" DROP CONSTRAINT "services_times_consistent";

ALTER TABLE "services" ADD CONSTRAINT "services_times_consistent" CHECK (
  "ends_next_day" = true
  OR "arrival_time" > "departure_time"
);
