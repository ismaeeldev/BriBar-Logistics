# 19. End client promoted from a lookup kind to its own model

**Status:** Accepted

## Context

ADR 0012 kept "Cliente final" as a plain `LookupKind.END_CLIENT` named list,
deliberately, because nothing downstream depended on its shape yet — the
roadmap's own open question (§6 B5) was whether it should stay a label or
become a full record. The client's 2026-09-17 change-request document
answers that question directly: an administrator must be able to assign a
"Cliente final" to a route/contract, in the same place they assign `Client`,
when editing that route's origin/destination. That is a real foreign-key
relationship, which `LookupItem`'s polymorphic-reference design (ADR 0012)
cannot express cleanly — `LookupItem` already has three separate typed
relations into the same table for exactly that reason, and a fourth for
"end client on a route" would only compound it.

## Decision

**`EndClient` is a new model, field-for-field identical to `Client`** — the
same reasoning that made `Supplier` mirror `Client` in ADR 0012: a business's
own name and tax id are the same two facts whichever side of a relationship
they sit on. `Route.endClientId` is added beside the existing `Route.clientId`,
same nullability, same `onDelete: Restrict`.

**Existing `LookupKind.END_CLIENT` rows are carried over, not discarded.**
The migration inserts one `EndClient` row per existing `LookupItem` of that
kind, reusing the same primary key, before dropping `END_CLIENT` from
`LOOKUP_KINDS` (the app-level list of offered kinds — the Postgres enum
value itself is left alone; dropping an enum value is more invasive than the
benefit justifies). No route referenced an end client before this change
(ADR 0012 confirmed "nothing downstream depended on its shape yet"), so this
is purely a name/id carry-over, not a re-link of existing data.

**The generic `/admin/lists/END_CLIENT` screen is retired** in favour of a
dedicated `/admin/end-clients` module (repository, service, schema, admin
pages), cloned from `client.repository.ts`/`client.service.ts` 1:1. This
follows the same trade-off ADR 0012 names for `Client`/`Supplier`: a kind
whose fields might grow, or that something now points at, gets its own
table rather than staying forced into the shared lookup table.

## Consequences

**`EndClientRecord.countDependents` returns only `{ routes }`**, unlike
`ClientRecord`'s `{ routes, issuedInvoices }` — nothing but `Route` ever
references an `EndClient`.

**The test harness's truncate order gained one entry.** `end_clients` joins
`clients` in `tests/integration/setup.ts`'s `TABLES`, positioned after
`routes` (which now references it) for the same "child before parent"
reasoning every other entry already follows.

**Two lookup-kind labels went stale by omission, not deletion.**
`LOOKUP_KIND_LABELS.END_CLIENT` stays defined (the Postgres enum value still
exists, so the type still requires it), but the "Listas" section hint no
longer mentions end clients among the lists it describes.
