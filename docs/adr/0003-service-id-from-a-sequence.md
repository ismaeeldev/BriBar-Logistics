# 3. Service IDs from a PostgreSQL sequence

**Status:** Accepted

## Context

SRS 19.1 requires a human-visible Service ID separate from the primary key.
SRS 23.4 requires that concurrent submissions never collide, and SRS 26.6 tests
it: "Two Drivers/users can submit at approximately the same time. Each receives
a unique service record/Service ID."

The obvious implementation — read the highest code for today, add one — has a
race between the read and the insert. Under two drivers submitting
simultaneously it produces either a duplicate or a unique-violation error the
driver sees as a failed submission.

Serialising with a lock fixes the race and introduces a bottleneck plus a
deadlock surface. A UUID or nanoid avoids both but is unreadable over the phone,
which defeats the point of a human-visible identifier.

## Decision

A dedicated PostgreSQL sequence, `service_code_seq`, formatted as:

```
SRV-20260902-000042
 |      |        |
 |      |        +-- nextval('service_code_seq'), zero-padded to 6
 |      +----------- business date in APP_TIMEZONE
 +------------------ SERVICE_CODE_PREFIX
```

`UNIQUE` on `services.service_code` remains as a backstop.

## Consequences

`nextval()` is atomic, never blocks, and is explicitly not rolled back by a
failed transaction. Two concurrent submissions are guaranteed different numbers
with no lock and no retry.

**The sequence is global, not per-day.** `SRV-20260903-000043` follows
`SRV-20260902-000042`; the counter does not reset each morning. A per-day
counter would reintroduce the race at every midnight boundary. The date segment
is for human readability, not uniqueness.

**Gaps are expected.** Because `nextval()` survives a rollback, a submission
that fails after allocating a number leaves that number unused. This is the
right trade — a gap is cosmetic, a collision is data loss — but the client may
read gaps as missing paperwork, so it is listed in `docs/open-questions.md`.

Six digits allows 999,999 services before the field widens; `formatServiceCode`
widens rather than truncating, and `SERVICE_CODE_PATTERN` accepts four or more
digits so codes issued before any widening still validate.
