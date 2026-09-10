# 14. Received invoices, and the investment summary (ERP roadmap Phase 3)

**Status:** Accepted

## Context

`docs/erp-migration/README.md` §4 scopes Phase 3 as "Received invoices +
Investments. Category→VAT rule, Inversión/Operación split, per-vehicle
investment tracking & recovery." It depends on Phase 1's finance core (ADR
0012), and it is where `Supplier` and `Expense category` — deferred out of
Phase 1 specifically because nothing consumed them yet — finally get built,
because this module is that consumer.

## Decision

**`Supplier` and `Expense category` are exactly the shape ADR 0012
predicted.** `Supplier` mirrors `Client` field-for-field — a name, an
optional tax id, active/inactive — because a business's identity is the same
two facts on either side of a transaction. `ExpenseCategory` carries the two
things `03Facturas_Recibidas` actually needs from a category: `expenseType`
(`OPERATION`/`INVESTMENT`/`NON_OPERATING`, `99_Listas`'s three-way split,
which is what makes the investment summary possible) and `defaultVatRate` (a
*suggested* rate, always overridable per invoice — the roadmap's own "10% if
Combustible else 21%... overridable, incl. 0% (exento)").

**The VAT math runs forwards here, backwards in Refuelling — and that
difference is real, not incidental.** A fuel receipt states a tax-inclusive
total, so Phase 2 works backwards from it (`baseFromGross`). A supplier
invoice states its taxable base up front — that is what "Base imponible"
printed on the document means — so this module works forwards
(`applyVat(baseCents, vatRate)`), the first real caller of that half of
`vat.ts`. Both still store the calculated pair rather than trusting two
independent calculations to agree (`received_invoices_vat_sum`, the same
discipline ADR 0013 established for `refuellings_base_vat_sum`): `vatCents`
and `totalCents` are only ever produced by the one `applyVat` call an
invoice's base and rate feed into.

**`invoiceDate` is administrator-supplied, unlike every other date column in
this codebase.** `services.service_date` and `refuellings.refuel_date` are
both server-set, following CLAUDE.md's "never trust the client for
serviceDate" rule — they record *when something happened*, and letting a
client backdate that would be letting it lie about an audit-relevant fact.
`received_invoices.invoice_date` records *what a document says*, a different
kind of fact entirely: an administrator transcribing a supplier's bill
received weeks late must be able to enter the date printed on it. Treating
this like every other date column would make the software wrong to be
convenient for the user it serves — a bill from March cannot become an April
bill because it was typed into the app in April.

**The investment summary is a live aggregate, not a stored table.** The
roadmap's own framing of `07_Inversiones` as a "view" (§4) is the answer:
`receivedInvoiceRepository.investmentTotalsByVehicle` is a `GROUP BY
vehicle_id` over `received_invoices` filtered to `category.expenseType =
'INVESTMENT'`, run fresh on every visit to `/admin/investments`. Nothing is
denormalised, so there is nothing that could drift from the invoices it
summarises — the same reasoning that keeps `AppConfig` from storing
per-document counters (ADR 0012) and that keeps `Refuelling`'s
`kmSinceLastRefuel` uncomputed until read (ADR 0013).

## Consequences

**"Recovery against accumulated profit" — the second half of §4's Phase 3
description — is explicitly not built.** Total investment per vehicle is
fully computable from this phase's own data; how much of it has been
recovered needs that vehicle's accumulated *profit*, which needs revenue
(services' rates - Phase 0) minus every cost source (fuel - Phase 2,
personnel - Phase 5, this phase's own operating expenses) netted together
over time. That is Phase 6's analytics layer by definition, not a query this
module could answer honestly on its own. `/admin/investments` shows what the
roadmap's own `07_Inversiones` framing supports today - the top half of the
sheet, not the derived payback figure underneath it - and says so in its own
copy rather than presenting a number recovery in disguise.

**A received invoice has no approval workflow**, unlike `Service`. The
Excel register is a flat, freely-editable list with no sign-off step, and
nothing in the roadmap asks for one here; admin-only creation already limits
who can write these records at all (the same reasoning ADR 0013 gives for
`Refuelling`).

**Four admin-nav sections instead of two.** `Client`, `Supplier`,
`ExpenseCategory` and now `Refuelling`/`ReceivedInvoice`/investment-summary
pushed a single "Finance" bucket past the point where it read as one thing.
The regrouping (Master data ⊇ real-world entities including `Client`/
`Supplier` now; Finance ⊇ the transactional modules; a new Settings section
⊇ configuration and taxonomy) is documented in `nav-items.ts` itself. Moving
`Client` out of Finance is a visible change for anyone who used Phase 1's
grouping, and worth naming here rather than only in a diff.
