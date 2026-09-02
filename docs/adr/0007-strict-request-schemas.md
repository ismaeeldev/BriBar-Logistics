# 7. Reject unknown request keys rather than stripping them

**Status:** Accepted

## Context

SRS 22.4 requires that "browser-supplied driver_id, approval user, timestamps,
calculations, or status shall not override server-owned values", and SRS 9.6
that "the server shall generate or verify all system-owned fields, rather than
trusting equivalent values supplied by the browser".

Zod's default is to strip unknown keys, which already satisfies the letter of
both: a payload carrying `driverId` has it silently discarded before it reaches
any Prisma call.

## Decision

Entity request schemas are `z.strictObject(...)`. A payload carrying a key the
schema does not declare is rejected with a 400 naming it.

Query-string schemas stay non-strict.

## Consequences

Stripping is safe. Rejecting is _observable_, and that difference is the point.

SRS 26.8 requires security tests proving "role escalation through modified
requests fails" and "driver ID substitution fails". Against a stripping schema
those tests assert an absence — the record was created and happens not to carry
the injected value — which passes just as readily if the field was never wired
up at all. Against a strict schema they assert a rejection, which can only pass
if the guard is present. `tests/unit/schemas.test.ts` enumerates every
server-owned field on `createServiceSchema` and asserts each one is refused.

Silence is also a poor way to learn that a client is trying something it should
not. A 400 naming the key surfaces both an integration bug and a probe; a strip
surfaces neither.

Query strings are exempt because they routinely carry unrelated parameters — a
tracking token, a stale bookmark — and a filter cannot escalate a permission.
Rejecting `?ref=newsletter` would be hostile for no security gain.

The cost is that a client sending a harmless extra field gets a 400 instead of
being tolerated. For a single first-party client that is a benefit: it fails
during development rather than shipping a mismatch. Were a third-party API added
later, that calculation would change, and this decision should be revisited then.
