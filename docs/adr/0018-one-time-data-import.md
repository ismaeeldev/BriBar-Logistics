# 18. The one-time data import (ERP roadmap Phase 7)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §3.5 and §4 scope Phase 7 as importing the
client's real spreadsheet once and then retiring Excel: "reads the `.xlsm`,
validates every row against the same Zod schemas the forms use, reports what
would be rejected, then writes in dependency order … idempotent, dry-run by
default." Confirmed as a **one-time migration, not a sync** (§3.6): the
importer runs once per environment and Excel becomes a frozen archive.

Two client questions the roadmap flagged for this phase (§6):

- **A2 — import depth.** Not formally answered; the roadmap's own lean is
  "full history is safer and not much more work given the row counts", and
  the importer is built for that (it takes whatever rows the bundle
  contains).
- **A3 — the cutover date.** A scheduling decision, not a code one;
  `docs/erp-cutover-runbook.md` is the checklist for whenever it lands.

## Decision

**The importer consumes a JSON bundle, not the `.xlsm` directly.** One object,
one key per source sheet, each an array of row objects already shaped to the
app's conventions (ISO dates, euro strings, references by name). A spreadsheet
parser (`exceljs` and friends) is a heavy dependency with its own transitive
tree, and this tool runs *once per environment*; adding a permanent parser to
`package.json` for that is the wrong trade against the project's deliberately
lean dependency list (`docs/architecture.md`). The operator produces the JSON
from the workbook once — the runbook documents how — and the substance the
roadmap asks for (validate every row, dependency order, idempotent, dry-run)
is entirely format-independent.

**Dry-run first, and a bundle with any error is refused whole.**
`migrationService.run(actor, bundle, { commit })` defaults to `commit: false`:
it builds an {@link ImportPlan} classifying every row as `create` / `skip` /
`error` and writes nothing. `commit: true` replays the plan **only if no row
is in error** — a partial import (some sheets in, some rejected) is worse than
none, because it leaves the operator reconciling a half-state against the
spreadsheet.

**Idempotency is by natural key.** Every importer's `loadExisting` reads the
keys already in the database; a row whose key is present plans as `skip`. So a
re-run after fixing a source row, or after an interrupted `--commit`, does not
duplicate anything — the same guarantee `prisma/seed.ts` gives. For master
data the key is the stored unique column (client name, plate, route code); for
`personnelCost` / `dailyKmLog` / `maintenanceRecord` it is a composite of
columns that are stored (`user+year+month`, `vehicle+date`,
`vehicle+type+performedDate`).

**Importers call the module *services*, not the repositories.** Each
`EntityImporter` maps its row onto the module's own `createXSchema`, runs that
exact schema (the roadmap's "same Zod schemas the forms use"), resolves
name references to ids via a shared {@link RefIndex}, and hands the parsed
input to `vehicleService.create` / `routeService.create` / … So every business
rule, every CHECK constraint and every audit-log write that a form submission
goes through, an imported row goes through too. The cost — each entity commits
in its own transaction rather than one transaction for the whole run — is
bounded by the plan-first refusal (a clean bundle rarely fails mid-write) and
erased by idempotency (re-run to finish).

**References resolve against the database first, then this run.** `RefIndex`
pre-loads every existing vehicle / route / client / … so an import into a
deployment an administrator has already partly set up resolves against the
real records; each importer then registers what it creates, so a later sheet
can point at it. A dry run tolerates a forward reference between two *new*
rows (it plans it as a valid `create` against a placeholder id) because the
real id does not exist yet; the commit pass, running importers in dependency
order, resolves every reference for real.

**Four sheets are deferred, with a specific reason each.** The importer set
covers all of `99_Listas`, `99_Config`, `04_Personal`, `00KmDiariosReales`
and `08_Mantenimiento`. It does **not** yet cover:

- **`tblRepostajes`** — `refuellingService.create` sets `refuelDate` to the
  business date "now" (SRS 9.2's server-owned-date discipline). A historical
  refuel must keep its real date, which needs either an admin-only
  `refuelDate` override on the refuelling schema (a small, defensible
  addition — `ReceivedInvoice.invoiceDate` already works this way) or a
  repository-level import path.
- **`tblFacturasRecibidas` / `tblFacturasEmitidas`** — the invoice services
  allocate the document code (`FR000090`) from a sequence, so the
  spreadsheet's own code cannot be preserved through them, and `FR`/`FE`
  numbers matter for the client's accounting cross-reference. Needs a
  repository-level path that writes the source code.
- **historical `tblServicios`** — beyond the code/date issues above, a
  historical service row needs `departureTime` / `arrivalTime` and approval
  metadata to satisfy `services_times_consistent` and
  `services_approval_metadata_consistent`; whether the sheet even carries
  those, and how far back to import given V1 services already run live, is a
  conversation to have with the client against the real file.

The engine is built to take all four — each is an `EntityImporter` — so this
is remaining work, not a redesign.

**The snapshot export is CSV-per-table, not `.xlsx`.** §3.6's optional
snapshot ("an `.xlsx` in roughly the original layout … Cut if the client
doesn't want it") is `pnpm erp:snapshot <dir>` writing one CSV per table.
Every CSV opens directly in Excel, which covers the stated purpose (an audit
safety net for the first months after cutover). A true multi-sheet `.xlsx`
would need the same spreadsheet-writer dependency the import side declined;
deferred unless the client asks for that specific format.

## Consequences

**A latent Phase 5 schema bug fixed in passing.** `daily-km-log.schema.ts`'s
`workedMinutesSchema` had `.optional()` *outside* its `preprocess`, so a blank
`workedHours` (`""`, which the admin form's `text()` helper submits) failed
validation with "expected string, received undefined". Moved inside; a blank
worked-hours field now submits cleanly, from the form and from the importer.

**A new dependency-free `src/lib/csv/`.** One tiny RFC-4180 serialiser, used
only by the snapshot script. Kept out of `src/modules/` because it is a
generic utility with no domain in it.

**No new schema, no migration.** Phase 7 adds a module, two scripts and a
runbook; it changes no table. (The one schema edit is the Phase 5 bug fix
above, which is a validation change, not a column change.)

**The ERP programme's remaining work is now explicit.** After this phase the
outstanding items are: the four deferred importers above, the `refuelDate`
schema decision, and the cutover itself (which is an operational task the
runbook covers, not code). Everything else the roadmap scoped — Phases 0
through 6 and the import engine — is built.
