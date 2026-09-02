# 6. Clock times as PostgreSQL `time`, mapped to `"HH:MM"`

**Status:** Accepted

## Context

SRS 19.7 types Departure Time and Arrival Time as `Time`, and SRS 31.3 describes
them as "operational time values supplied by the Driver" while requiring audit
timestamps in UTC. They are wall-clock readings, not instants: "departed at
07:45" means 07:45 wherever the driver was, and must never be shifted by a
timezone conversion.

PostgreSQL models this exactly with `time`. JavaScript does not model it at all,
so Prisma surfaces a `time` column as a `Date` pinned to 1970-01-01. Every
`Date` accessor except the UTC ones applies the server's local offset, which
makes this a reliable source of off-by-one-hour bugs that never reproduce on a
developer's machine in the same zone as the database.

Alternatives considered: store as `VARCHAR(5)`, which is simple but gives up
type integrity and makes any future duration query a string parse; or as
`SMALLINT` minutes since midnight, which is compact and orderable but unreadable
in the Neon console and against SRS 19.7.

## Decision

PostgreSQL `time(0)`, with `src/lib/time/time-of-day.ts` as the sole boundary.
Above it every layer works with `"HH:MM"` strings; only its two mappers touch
the `Date` representation, and only through UTC accessors.

The parsed string carries a `TimeOfDay` brand, so an unvalidated `string` cannot
reach `timeOfDayToDate` — the compiler rejects it, and the mapper never
re-checks at runtime.

## Consequences

Database-level type integrity is kept: PostgreSQL rejects `25:00`, ordering
works, and future duration reporting (SRS 28.6) can do time arithmetic in SQL.

The mapping is the risk, so it is tested twice. A unit test asserts
`timeOfDayToDate('07:45').toISOString() === '1970-01-01T07:45:00.000Z'`, pinning
the UTC contract without a database. An integration test writes 07:45 and 23:59
to a real column and reads them back, which is the only way to catch a change in
how Prisma serialises the type.

`time(0)` discards sub-second precision. A driver reading a clock has no use for
it, and the column is narrower.

**No ordering rule is applied between departure and arrival.** SRS 31.3 rules
out overnight-service logic for V1, and a service departing 22:00 and arriving
02:00 is legitimate, so a naive `arrival > departure` check would reject real
data. `timeOfDayToMinutes` exists for future duration work and is deliberately
not used for validation. This is listed in `docs/open-questions.md` because the
consequence — a transposed pair of times passes validation — is worth the client
knowing about.
