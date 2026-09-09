# 12. Finance-core primitives and master-data extensions (ERP roadmap Phase 1)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §4 scopes Phase 1 as "finance core +
master-data extensions": the money/VAT/fiscal-period/document-sequence
libraries every later financial module will share, plus the new master-data
entities the client's Excel ERP has and the app does not (`§2`) — clients,
end clients, and the several simple named lists `99_Listas` and `99_Config`
hold. The roadmap made Phase 1 conditional on two client questions (§6 B4
"Contrato vs. Route" and E13 "module order"); both are now resolved
(Contrato = Route, no new layer; proceed in the roadmap's default order), so
this is the first slice of that phase.

Full Phase 1 as scoped in the roadmap also includes Supplier and Expense
category. Both are deliberately **not** built here — see Consequences.

## Decision

**The domain math has no consumer yet, and is built anyway.** `applyVat`,
`baseFromGross` (`src/modules/shared/domain/vat.ts`), `fiscalPeriodFromParts`
(`fiscal-period.ts`) and `formatDocumentCode` (`document-sequence.ts`) are
pure, dependency-free, and unit-tested in isolation — the same shape as
`mileage.ts` and `service-code.ts` before them. Nothing calls them yet
(Phase 2's refuelling module is the first real caller), which is the point:
getting the arithmetic right once, ahead of the module that will lean on it
under a deadline, is cheaper than deriving it inline the first time a
category needs a VAT split.

**Money and litres are both integer-scaled, never float.** `VAT_RATE_PERCENT`
operates on cents already produced by `src/lib/money/money.ts`.
`src/lib/units/fuel.ts` gives litres the same treatment — millilitres, not a
`Float` column — for `AppConfig.defaultConsumptionMlPer100Km`, which is the
first non-money measurement this codebase stores; the same reasoning that
ruled out a float rate in ADR-adjacent Phase 0 work applies here.

**One `LookupItem` table, not four.** Fuel types, payment methods, supplement
types and end clients are, in the client's own spreadsheet, identical in
shape — a name, offered or not. Modelling each as its own table would be four
copies of `vehicle.repository.ts` for a record with one real field. Instead,
`LookupItem` carries a `kind` discriminator (`LookupKind`), every repository
method takes `kind` as its first parameter and scopes its query to it, and
one dynamic route (`/admin/lists/[kind]`) serves all four. A fifth simple
list is a new enum value and a dictionary label, not a new module. A kind
whose fields grow past a name — Supplier, Expense category, both deferred —
gets its own table instead of being forced into this one.

**Client is a real table, not a `LookupItem` kind.** Unlike the four lists
above, a client is a genuine entity roadmap §2 expects to grow contacts,
addresses and its own invoices; giving it a dedicated model now avoids a
later migration off the lookup table. `End client`, by contrast, stays a
`LookupItem` (§6 B5 is still unanswered — see Consequences) because nothing
downstream depends on its shape yet.

**`AppConfig` is a singleton with a fixed, human-readable id.** `id:
"default"` rather than a generated UUID, seeded once by the migration.
Every caller does `findUnique({ id: 'default' })` (or, in this codebase,
`findUniqueOrThrow` — a missing row is a deployment that skipped the seed,
not a state to paper over) with no "does the row exist" branch. The one
friction this caused: `audit_logs.entity_id` is `Uuid`-typed like every other
audited entity's primary key, and `"default"` is not a UUID. Rather than
loosen that column for one table, `config.repository.ts` exports a fixed nil
UUID (`APP_CONFIG_AUDIT_ID`) used only as the audit entity id — the config
row's real identity stays the readable constant everywhere else.

**Per-document-type sequences are not created yet.** The roadmap names six
series (`S`, `R`, `FR`, `FE`, `MT`, `T-`); only `S` (services) exists today.
`formatDocumentCode` is the shared formatting half of ADR 0003's pattern;
the other half — an actual `CREATE SEQUENCE`, a `pnpm db:set-sequence`
continuation step, a `nextval()` call — is created by whichever phase first
writes that document, not spun up in advance as schema nothing uses yet.

## Consequences

**Supplier and Expense category are not built in this pass.** Both need
Phase 3's category → VAT-rate rule (`Combustible → 10%`, else `21%`,
overridable) to have a defensible shape, and building them now would mean
guessing that rule's exact fields ahead of the phase that actually consumes
them. They ship with Phase 3.

**`Client`/`End client` are not yet wired to anything.** No service, no
invoice references a client — that join is Phase 4's decision, and which of
the two "Cliente final" becomes (§6 B5: a label vs. a full record) is still
an open client question. Master data an administrator can enter today is
still useful on its own, and adding the reference later is additive.

**`configService.get()` is intentionally not admin-only.** Every other new
service in this phase gates on `Role.ADMIN`; config is read-only for anyone
signed in, because Phase 2 and Phase 5 will read these defaults from
driver-facing forms (a suggested consumption, a suggested fuel price) as well
as the admin settings screen. Nothing in `AppConfig` is sensitive the way a
route's rate is — these are operational constants, not pricing — so there is
no reason to route every read through an admin check that would otherwise be
duplicated in two driver-facing modules soon.

**The test harness gained a second reset shape.** `clients` and
`lookup_items` joined the existing `TRUNCATE ... CASCADE` list in
`tests/integration/setup.ts`; `app_config`, being a singleton rather than a
collection, is truncated and reseeded to its defaults separately, in the same
`beforeEach`. Skipping this — as the first version of this change did — means
one test's `configService.update()` silently changes the defaults every
later test in the suite starts from.
