# ERP cutover runbook (roadmap Phase 7)

The one-time move from the client's Excel ERP into the app. After it, Excel is
a frozen archive and the app is the sole system of record — there is no sync
(roadmap §3.6).

Do this in **UAT first**, end to end, and only then in production.

---

## 0 · Before the day

- [ ] Every earlier phase is deployed and `pnpm verify` + `pnpm test:integration`
      are green on the release commit.
- [ ] An administrator account exists in the target environment (`pnpm db:seed`).
- [ ] You have the client's workbook, `ERP_Transporte_ANONIMIZADO.xlsm` (or the
      real, non-anonymised one for production), and know which period it covers.
- [ ] A fresh database backup has been taken.
- [ ] Agree the **cutover moment** with the client (roadmap §6 A3): after it they
      work only in the app.

---

## 1 · Produce the import bundle

The importer reads **one JSON file**: an object with one key per source sheet,
each an array of row objects. Field names and formats are the app's own:

| In the sheet | In the bundle |
| --- | --- |
| A date cell | `"2026-03-04"` (ISO `yyyy-MM-dd`) |
| A money cell | a plain string, `"1234.56"` (dot decimal, no thousands separator, no `€`) |
| Litres / hours | a plain string, `"11.5"` |
| A reference (contract, client, supplier, category, vehicle, type…) | the **name** exactly as it appears in `99_Listas`, as a string |
| Active / inactive | `"true"` / `"false"` (or leave the key out — defaults to active) |

Sheets the importer currently consumes, and the keys each row needs:

```
lookup:FUEL_TYPE | lookup:PAYMENT_METHOD | lookup:SUPPLEMENT_TYPE
lookup:END_CLIENT | lookup:GAS_STATION | lookup:INVOICE_STATE | lookup:MAINTENANCE_TYPE
   { name, isActive? }

tblClientes            { name, taxId?, isActive? }
tblProveedores         { name, taxId?, isActive? }
tblCategoriasGasto     { name, expenseType: OPERATION|INVESTMENT|NON_OPERATING, defaultVatRate?, isActive? }
tblVehiculos           { registrationPlate, referenceName?, isActive? }
tblContratos           { code, name, origin, destination, defaultRate?, client?, isActive? }
tblPersonal            { employee, year, month, base, overtime?, allowances?, other?, notes? }
tblKmReales            { vehicle, contract?, driver?, date, actualKm, workedHours?, notes? }
tblMantenimientos      { vehicle, type, performedDate, performedKm?, nextDueKm?, nextDueDate?, notes? }

config                 [{ oilChangeIntervalKm, defaultConsumption, defaultFuelPrice }]
```

`tblRepostajes`, `tblFacturasRecibidas`, `tblFacturasEmitidas` and historical
`tblServicios` are **not** imported by this tool yet — their document codes /
server-set dates need a repository-level path (ADR 0018). Enter them by hand for
the migrated period, or wait for that path.

**How to build the JSON** — any of:

- LibreOffice / Excel: save each needed sheet as CSV, then convert with a
  throwaway script;
- an online "xlsx to json" converter, then reshape the keys/values to the table
  above;
- `npx xlsx-cli` or similar, once, on the operator's machine (not added to the
  project).

Keep the bundle file out of git — it holds real business data.

---

## 2 · Dry run

```
DATABASE_URL=<target> pnpm erp:import ./erp-bundle.json
```

Reads nothing but the file and the database; **writes nothing**. Prints a table
of `create` / `skip` / `error` per entity, then every row it could not plan,
with its sheet and row number.

- [ ] Zero errors. Fix the source rows and re-run until the report is clean.
- [ ] The `create` counts match what you expect from the sheet row counts.
- [ ] `skip` counts are what you expect (0 on a virgin database; the already-set-up
      master data on one an administrator has touched).

---

## 3 · Commit

```
DATABASE_URL=<target> pnpm erp:import ./erp-bundle.json --commit
```

Replays the plan in one pass. Refuses outright if any row is in error. Every
write is idempotent on a natural key, so if it is interrupted, **just run it
again** — done rows skip.

- [ ] Report ends with `COMMITTED` and no errors.

---

## 4 · Continue the document numbering

The spreadsheet's series (`S000140`, `R000046`, `FR000090`, `FE000003`,
`MT000005`) must continue, not restart:

```
pnpm db:set-service-start <last S number>
# and, for each other series once its importer exists, the equivalent set-sequence step
```

- [ ] The next service / refuel / invoice created in the app carries the number
      after the spreadsheet's last.

---

## 5 · Reconciliation (UAT sign-off)

The app's totals must match the spreadsheet **to the cent** for the migrated
period (roadmap §4, Phase 7). Compare, for the same year (and a spot-check
month):

| App | Against the sheet |
| --- | --- |
| `/admin/analytics` → Revenue, Fuel, Personnel, Operating expenses, Operating margin | `00Dashboard` / `00Análisis` monthly margin block |
| `/admin/analytics` → per-vehicle margin, empty km, €/km | `00Análisis` per-vehicle rows |
| `/admin/analytics` → per-contract €/km, efficiency, estimated fuel | `00Análisis` per-contract rows |
| `/admin/investments` and `/admin/analytics` → investment recovery | `07_Inversiones` |
| `/admin/taxes` → quarterly IVA repercutido / soportado / balance | `06_Impuestos` |
| `/admin/maintenance` → due bands | `08_Mantenimiento` alerts |

- [ ] Every figure matches, or the difference is explained (rounding to the cent
      is expected and was accepted — roadmap §6 C9).
- [ ] The client has run `docs/prueba-de-aceptacion.md` (V1 acceptance) and the
      ERP walk-through, and signed off.

---

## 6 · Cutover

- [ ] Announce the cutover moment. From here the client works only in the app.
- [ ] Freeze the spreadsheet: mark it read-only, keep it as the archive of what
      came before. Do not edit it again.
- [ ] Take a post-import backup.
- [ ] Optional: `pnpm erp:snapshot ./snapshot-<date>` for an Excel-openable
      point-in-time dump, as an audit safety net for the first months (§3.6).

---

## Rollback

Nothing here is destructive to existing rows — the importer only inserts, and
only rows whose natural key is absent. If a committed import is wrong: restore
the pre-import backup, fix the bundle, start again from step 2.
