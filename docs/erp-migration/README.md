# BRIBAR ERP — migration & replication roadmap (V2)

**Status:** proposal, pending client answers to the [questions in §6](#6-questions-for-the-client).
**Source of truth for the model:** `ERP_Transporte_ANONIMIZADO.xlsm` (this folder),
the client's live Excel ERP, anonymised.

---

## 1. What this is

V1 (the current app) implements the SRS: **Services** — a driver records a route
sheet on a phone, an administrator approves it. SRS 29 explicitly excluded
everything else the business runs on: fuel, invoicing, personnel, taxes,
investments, maintenance, reporting, and the Excel/M365 integration.

The client now wants the app to **replace the spreadsheet as the system of
record** — not by importing numbers, but by reproducing the spreadsheet's
*logic*: the same relationships, the same formulas, the same results, adapted to
a database. The existing Excel data must come across, and the app and the
spreadsheet must stay in sync during a transition period.

This is a V2 programme: **10 new modules, a shared financial core, a reporting
layer, a data-import tool, and an Excel bridge.** Estimated **35–50 developer-days**
depending on the answers below, delivered in the phases in §4.

---

## 2. The spreadsheet, sheet by sheet

Every sheet is an Excel **Table** (`tbl…`) with derived columns. Year / Month /
Quarter are `=YEAR()/=MONTH()/=ROUNDUP(MONTH()/3,0)` on a date column — in the
app these become derived/indexed values, never stored inputs.

| Sheet | Table | Rows | Becomes | Key derived values (Excel formula → app) |
| --- | --- | --- | --- | --- |
| `01Servicios` | `tblServicios` | 140 | **Services** (exists) + billing fields | `Base imponible = XLOOKUP(Contrato → tblTarifasContratos) + Imp. suplemento` |
| `00KmDiariosReales` | `tblKmReales` | ~90 | **Daily real km** module | `Km reales`, `Horas` per vehicle/contract/day; feeds vehicle-utilisation KPIs |
| `02Repostajes` | `tblRepostajes` | 46 | **Refuelling** module | `Precio/L = Total/Litros`; `Base = Total/1.21`; `IVA = Base×%IVA`; `Km desde últ. repostaje` (odometer delta); `Consumo L/100km` |
| `03Facturas_Recibidas` | `tblFacturasRecibidas` | 90 | **Received invoices** module | `Tipo = Inversión\|Operación` (from category); `%IVA = 10% if Combustible else 21%` (overridable, incl. `0% (exento)`); `IVA`, `Total` |
| `04_Personal` | `tblPersonal` | ~14 mo. | **Personnel** module (monthly cost rows) | `Coste total = real + h.extra + dietas + otros`; `Coste fijo diario = Coste total / días del mes` |
| `05Facturas_Emitidas` | `tblFacturasEmitidas` | 3 | **Issued invoices** module | `Base imponible = SUMIFS(tblServicios.Base, ID Factura)`; `IVA`, `Total`; links a set of services to one client invoice |
| `06_Impuestos` | — | quarterly | **Taxes** view (derived) | `IVA soportado = Σ facturas recibidas.IVA`; `IVA repercutido = Σ facturas emitidas.IVA`; `A ingresar/devolver = repercutido − soportado`, by year+quarter |
| `07_Inversiones` | — | per-vehicle | **Investments** view (derived) | `Total inversión = SUMIFS(tblFacturasRecibidas.Total, Vehículo, Tipo="Inversión")`; recovery = accumulated vehicle profit vs. total investment |
| `08_Mantenimiento` | `tblMantenimientos` | 5 | **Maintenance** module | `Próximo km = Km realización + 15000` (oil change); `Próxima fecha = EDATE(fecha, 6)` (ITV); alert bands URGENTE/PRÓXIMO/OK |
| `99_Listas` | 17 tables | — | **Master data / configuration** | Contracts, vehicles, drivers, **clients + end-clients**, gas stations, fuel types, payment methods/forms, suppliers, expense categories (+ Operación/Inversión/No-operativo), VAT rates (21/10/4/0/exento), supplement types, quarters, months, maintenance types, invoice states, **`tblTarifasContratos` = Contract → base rate €** |
| `99_Config` | — | 8 values | **Config** | oil-change interval (15 000 km), default consumption (11 L/100km), default fuel price (1.52 €/L), per-module last-ID counters |
| `90_Modelo` | pivot caches | — | *(nothing)* — replaced by real aggregate queries |
| `00Análisis` / `00Dashboard` | pivot-driven | — | **Analytics & dashboard** (§3.4) |

### New entities V1 does not have

- **Client** and **End client** (`Cliente` / `Cliente final`). A service is for a
  client; end-client is a free-text tag today.
- **Contract rate** (`tblTarifasContratos`): each contract/route has a **base rate
  in €**, admin-only. This is item #4 of the current change request and the first
  slice of the billing model.
- **Service supplement** (`Imp. suplemento €` + `Tipo suplemento`): extra charge on
  a service (waiting time, extra stop, night, holiday…). `Base imponible = rate +
  supplement`.
- **Additional staff on a service** (`Personal adicional`).
- **Vehicle odometer history** — currently only `Repostajes.Km Odómetro`; the
  consumption and "km since last refuel" calculations depend on it.
- **Fiscal period** as a first-class concept (year / month / quarter) shared by
  every financial module.

---

## 3. Architecture — the shared foundation

Built once, in `src/modules/shared` and a new `src/modules/finance`, so every
module in §4 sits on it "without rebuilding the system" (the client's words, and
SRS 1.2).

### 3.1 Money & VAT (`src/lib/money/`, dependency-free `domain/`)

- Amounts as **integer cents** in the database (`Int`), never `Float`. A
  `Money` domain type wraps arithmetic; presenters format to `1.234,56 €` via the
  existing `NUMBER_LOCALE`.
- `VatRate` enum: `STANDARD (21)`, `REDUCED (10)`, `SUPER_REDUCED (4)`,
  `ZERO (0)`, `EXEMPT`. A pure `applyVat(baseCents, rate) → { vatCents, totalCents }`
  and its inverse `baseFromGross(grossCents, rate)` (the spreadsheet's `=Total/1.21`).
- The category → default-VAT rule (`Combustible → 10%`, else `21%`, overridable)
  lives in the received-invoices domain, not hard-coded in a form.

### 3.2 Fiscal periods (`src/modules/shared/fiscal-period.ts`, pure)

`year`, `month (1–12)`, `quarter (1–4)`, derived from a date in `APP_TIMEZONE`
(reuses `businessDateFor`). Every financial row exposes them as generated
columns / query expressions, so "by month", "by quarter", "year to date" are
index-backed filters, not stored duplicates that can drift.

### 3.3 Document numbering (`src/modules/shared/document-sequence.ts`)

The spreadsheet's `S000140`, `R000046`, `FR000090`, `FE000003`, `MT000005`,
`T-00003`. Generalise the existing `service_code_seq` pattern (ADR 0003): one
PostgreSQL sequence per document type, a `formatDocumentCode(prefix, width, n)`
helper, and a `pnpm db:set-sequence <type> <n>` script so go-live continues each
series from the spreadsheet's last value (`99_Config`).

### 3.4 Reporting layer (`src/modules/analytics/`)

The dashboard and analysis sheets are ~55 `SUMIFS`/`XLOOKUP` formulas over the
transaction tables, filtered by year/month/vehicle. In the app these become a
small number of **aggregate SQL queries** (`GROUP BY` fiscal period, vehicle,
contract) behind a `analyticsService`, each returning a typed DTO:

- **Operating margin** per month/vehicle: `facturación − combustible − coste
  personal − gastos de explotación`.
- **Vehicle utilisation**: `km reales`, `km servicio`, `km vacío = reales −
  servicio`, `% vacío`, `% facturados`.
- **Fuel**: litres, `precio medio €/L`, `consumo medio L/100km`, `coste comb.`,
  `coste comb./km`.
- **Per-contract** (`00Análisis`): `€/km = facturación / km servicio`,
  `eficiencia = km servicio / km reales`, estimated fuel cost at the standard
  rate, `margen operativo`.
- **Per-driver** (`04_Personal` KPI block): services driven, days worked, km,
  `facturación / km real`, average ticket.
- **Maintenance due**: next oil-change km vs. latest odometer; next ITV/insurance
  date vs. today; URGENTE / PRÓXIMO / OK bands (thresholds from config).
- **Investment recovery** per vehicle: cumulative profit vs. total investment.
- **Quarterly VAT** (`06_Impuestos`).

Charts reuse the existing `src/components/charts/*`.

### 3.5 Data import (`src/modules/migration/`, admin-only, one-time)

Reads the `.xlsm`, validates every row against the same Zod schemas the forms
use, reports what would be rejected, then writes in dependency order (master
data → contracts/rates → services → fuel → invoices → …). Idempotent, dry-run
by default. This is how the client's real history comes across.

### 3.6 Excel sync — **needs a decision (see open questions)**

Options, cheapest first: (a) **export only** — the app generates an `.xlsx` in the
same layout on demand; the client keeps Excel as a read-only mirror. (b) **export +
re-import** — scheduled two-way reconciliation with a conflict report. (c) **live
M365 / Graph API sync** — a genuine integration, its own project. The roadmap
below assumes (a) until told otherwise.

---

## 4. Phased plan

Each phase ends at something the client can use. Dependencies are strict —
finance core before any money module, master data before transactions.

| Phase | Scope | Days | Depends on |
| --- | --- | --- | --- |
| **0** | **Change-request items 1, 2, 4** — editable origin/destination (done), arrival-time clarification, **contract base rate + admin service rate/supplement + `Base imponible`**. First real slice of billing. | 3–4 | — |
| **1** | **Finance core + master-data extensions.** Money/VAT/fiscal-period/document-sequence libs; Client & End-client entities; expense categories, suppliers, fuel types, payment methods, supplement types as master data; config screen. ADR for each non-obvious call. | 6–7 | 0 |
| **2** | **Refuelling** module. Odometer history, `km since last refuel`, consumption, per-refuel VAT. Feeds fuel KPIs. | 4 | 1 |
| **3** | **Received invoices** + **Investments**. Category→VAT rule, Inversión/Operación split, per-vehicle investment tracking & recovery. | 5 | 1 |
| **4** | **Issued invoices** + **Taxes**. Group approved services into a client invoice; `Base = Σ service base`; quarterly IVA soportado/repercutido. | 4 | 0, 3 |
| **5** | **Personnel** + **Daily real km** + **Maintenance**. Monthly personnel cost rows, `coste fijo diario`; daily-km capture; maintenance log with due-date engine. | 6 | 1 |
| **6** | **Analytics & dashboard.** All aggregate queries, per-contract / per-vehicle / per-driver views, the maintenance-alert panel, the scenario simulator. Replaces `00Dashboard` / `00Análisis` / `90_Modelo`. | 6–8 | 2–5 |
| **7** | **Data import** of the client's real spreadsheet; **Excel export**; UAT against the spreadsheet's own numbers (the app's totals must match Excel to the cent for a shared period). | 5–7 | all |

**Cross-cutting, every phase:** Spanish strings in `messages.ts`; strict request
schemas; `domain/` stays dependency-free; migrations `--create-only` with the
hand-written CHECK block preserved (CLAUDE.md); unit + integration tests; an ADR
per non-obvious decision.

---

## 5. Where the current app stands against this

Two honest framings, because "how far along are we" has two answers.

### 5.1 By module

| ERP area (Excel sheet) | In the app today | Coverage |
| --- | --- | --- |
| **Platform** — auth, roles, sessions, audit log, notifications, i18n, design system, the layered architecture | Complete, and carries into every module below unchanged | **100%** |
| Services — *operational half* (01Servicios) — driver records a sheet, admin approves, history, filters, status audit | Complete | **100%** |
| Services — *billing half* — client, end-client, supplement (amount + type), `Base imponible` (rate + supplement), issued-invoice link | Not built | **0%** |
| Master data — vehicles | Full CRUD + activate/deactivate | **100%** |
| Master data — drivers / users / route assignments | Full CRUD + roles | **100%** |
| Master data — routes / contracts | Full CRUD; **no base rate** | **80%** |
| Master data — clients & end-clients | — | **0%** |
| Master data — suppliers, gas stations, expense categories, fuel types, payment methods/forms, supplement types | — | **0%** |
| Config (99_Config) — oil interval, default consumption, fuel price, per-document ID counters | Only the Service ID sequence exists | **~10%** |
| Daily real km (00KmDiariosReales) | — | **0%** |
| Refuelling (02Repostajes) | — | **0%** |
| Received invoices (03Facturas_Recibidas) | — | **0%** |
| Personnel (04_Personal) | — | **0%** |
| Issued invoices (05Facturas_Emitidas) | — | **0%** |
| Taxes (06_Impuestos) | — | **0%** |
| Investments (07_Inversiones) | — | **0%** |
| Maintenance (08_Mantenimiento) | — | **0%** |
| Analytics & dashboard (00Dashboard / 00Análisis) | Service-operations dashboard only: pending/approved counts, today vs. yesterday, 7-day trend, 14-day activity chart, top routes by km, an exceptions panel. **No money, fuel, margin, €/km, or per-vehicle/contract/driver figures.** | **~10%** |
| Finance core (money / VAT / fiscal periods / document numbering) | Service ID sequence is the only piece | **~5%** |
| Data import from Excel · Excel export / sync | — | **0%** |

### 5.2 By effort

- **Foundation already built:** ~25–28 developer-days (`docs/roadmap.md`, phases
  1–4). Effectively all of it — the platform, the approval workflow, the driver
  mobile UX, the design system, the module architecture — is reused as-is.
- **ERP programme remaining:** ~35–50 developer-days (§4).

So the app today is roughly **35–40% of the total build by effort**, but only
**~15% of the feature scope the client described** — it delivers 1 of ~12
functional areas, and the operational half of that one. **The ERP work roughly
doubles the system.**

---

## 6. Questions for the client

Answers change the estimate and the schema. **Nothing in Phase 1 starts until
A1–A2, B4, and E13 are settled**; the rest can be answered as each phase begins.

### A · Scope & transition

1. **Excel sync — which kind?**
   (a) a "Download to Excel" button that regenerates the workbook on demand;
   (b) a scheduled two-way reconciliation with a conflict report;
   (c) a live Microsoft-365 / Graph integration.
   These are weeks of work apart.
2. **Historical data** — import the **entire** spreadsheet history into the app,
   or start clean from a go-live date and keep the current Excel as a frozen
   archive?
3. **Cut-over** — a period where Excel and the app are both kept up to date in
   parallel, or a hard switch on one date?

### B · Data model

4. **Contrato vs. Route** — is "Contrato" the same thing as a Route in the app
   (both name the work a vehicle does), or a layer above it (a client has
   contracts, a contract has routes)? The base rate lives on whichever it is.
5. **Clients & end clients** — is "Cliente final" just a label on a service, or a
   real record you manage (its own contacts, addresses, its own invoices)?
6. **Vehicle odometer** — today it is recorded only on refuels. Should drivers
   also record the odometer on every service? It makes consumption and
   "km since last refuel" far more reliable.

### C · Money & tax

7. **VAT on issued invoices** — always 21%? Any reduced-rate, exempt, or
   intra-EU (reverse-charge) cases?
8. **Supplements** — is `Imp. suplemento` always *added* to the base rate, or can
   a supplement *replace* it for some services?
9. **Rounding** — Excel keeps full precision and rounds on display; the app
   stores each amount rounded to the cent, so annual totals may differ from the
   spreadsheet by a few cents. Acceptable? (standard accounting practice)

### D · Operations & responsibilities

10. **Who enters refuelling and daily km** — the driver on the phone, an
    administrator only, or either?
11. **Personnel detail** — just the monthly cost total that feeds the margin
    calculations (what the sheet has), or per-day / per-shift tracking and
    payslip-level records?
12. **Maintenance rules** — is the due-date engine complete as *next oil change
    at +15 000 km, next ITV at +6 months*, or are there other maintenance types
    with their own intervals?

### E · Priorities & scale

13. **Module order** — the roadmap's default is: contract rates & billing →
    refuelling → received invoices & investments → issued invoices & taxes →
    personnel / daily km / maintenance → analytics. Agree, or reprioritise?
14. **Fleet & clients** — the sheet has ~2 vehicles and 1 client today, but the
    master lists anticipate more. Confirm the app should assume a growing fleet
    and multiple clients from day one (it will).

---

## 7. What is already in motion

- **Item 1 (editable origin/destination)** — implemented, branch
  `feat/editable-origin-destination`.
- **Item 2 (arrival time on next-day services)** — fixed, branch
  `fix/next-day-arrival-time`. Ticking "Llega al día siguiente" now accepts the
  arrival time as entered; `migration 20260909000000` relaxes the constraint.
- **Item 4 (contract rate)** — folded into **Phase 0** above rather than built in
  isolation, because it *is* the start of the billing model and should share the
  money/VAT foundation.
