# 3. Service IDs from a PostgreSQL sequence

**Status:** Accepted. Format revised 2026-09-02 after client input.

## Context

SRS 19.1 requires a human-visible Service ID separate from the primary key.
SRS 23.4 requires that concurrent submissions never collide, and SRS 26.6 tests
it: "Two Drivers/users can submit at approximately the same time. Each receives
a unique service record/Service ID."

The client keeps an existing register, "01Servicios", in which services are
numbered sequentially. The new system must continue that series rather than
start its own (`docs/open-questions.md` #2) — the numbers appear on paperwork the
business already treats as authoritative.

The obvious implementation — read the highest number, add one — has a race
between the read and the insert. Under two drivers submitting simultaneously it
produces either a duplicate or a unique-violation error the driver sees as a
failed submission. Serialising with a lock fixes the race and introduces a
bottleneck plus a deadlock surface.

## Decision

A dedicated PostgreSQL sequence, `service_code_seq`, rendered as a plain decimal
number: `1`, `2`, `3`, … `1248`.

No prefix, no date segment, no zero padding. An earlier iteration used
`SRV-20260902-000042`; it was dropped once the client confirmed the numbering
must match 01Servicios, because every one of those additions breaks continuity.

`UNIQUE` on `services.service_code` remains as a backstop.

## Consequences

`nextval()` is atomic, never blocks, and is explicitly not rolled back by a
failed transaction. Two concurrent submissions are guaranteed different numbers
with no lock and no retry.

**Gaps are expected.** Because `nextval()` survives a rollback, a submission that
fails after allocating a number leaves it unused. This is the right trade — a gap
is cosmetic, a collision is data loss — but the client may read gaps as missing
paperwork, so it is documented in `docs/open-questions.md`.

**Continuity is a deployment step, not a migration.** The sequence starts at 1,
and the highest number in 01Servicios is not known at migration time.
`scripts/set-service-code-start.ts` advances it, refuses to move it backwards,
and refuses to run if the `services` table already holds a higher code. The seed
script warns whenever the sequence is still untouched. Hard-coding a guessed
starting value would have been worse than an explicit, checked step.

`formatServiceCode` is a one-line function that returns `String(sequence)`. It is
kept as a named function anyway: it is the single definition of the format, so a
future padding or prefix requirement is one edit with one set of tests rather
than a search for string concatenation.
