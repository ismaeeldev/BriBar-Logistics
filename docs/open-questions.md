# Decisions and open questions

Points where the SRS was silent, ambiguous, or deferred to "operational
acceptability". All ten were put to the client and answered on 2 September 2026;
what follows records each answer, what it changed, and what is still outstanding.

**Two items still need client input** — both at the bottom, both cheap to answer,
both worth settling before the interface is built.

---

## Resolved

### 1. Business timezone → `Europe/Madrid`

Decides which calendar day a service belongs to. Madrid is CET/CEST (UTC+1/+2),
so a service submitted at 00:30 local is the _previous_ day in UTC; deriving the
date from the UTC instant would file it a day early.

Applied as `APP_TIMEZONE`. `businessDateFor` converts through the zone before
taking the calendar day, and a unit test pins the midnight-boundary case.

### 2. Service IDs → plain sequential numbers, continuing 01Servicios

`1`, `2`, `3`, … No prefix, no date, no zero padding. The format built in Phase 1
(`SRV-20260902-000042`) was dropped: the new system must carry on the numbering
already in the client's register, and anything added would break continuity with
records the business treats as authoritative.

Two consequences worth knowing:

- **The sequence never resets.** It is global, which is what makes concurrent
  submission collision-proof (SRS 23.4) without a lock.
- **Gaps are expected.** A submission that fails after allocating a number
  leaves it unused. Gaps are cosmetic; collisions are data loss.

> ⚠️ **Deployment step.** The sequence starts at 1. Before go-live it must be
> advanced past the highest number in 01Servicios, or the system will re-issue
> IDs already printed on paperwork:
>
> ```bash
> pnpm db:set-service-start 1247
> ```
>
> The script refuses to move the sequence backwards, and `pnpm db:seed` warns
> while it is still unset.

### 3. Arrival before departure → rejected on the same day, allowed overnight

The client's rule: _"if it's conflicting on same day and arrival is less than
departure then we should reject."_

Two bare clock times cannot express that. `departs 22:00, arrives 02:00` is
either a transposition typo or a real overnight run, and nothing in the pair
tells them apart — so rejecting outright would make overnight services impossible
to record, and accepting outright is the behaviour we were asked to stop.

The service therefore carries one extra flag, `endsNextDay`, and the rule becomes
a single comparison each way:

| `endsNextDay`     | Rule                                 | Rationale                            |
| ----------------- | ------------------------------------ | ------------------------------------ |
| `false` (default) | arrival must be **after** departure  | the client's rule                    |
| `true`            | arrival must be **before** departure | otherwise the service ran ≥ 24 hours |

This is the minimum SRS 31.3's own escape clause allows — no arrival date column,
no timestamp migration, one boolean. Enforced in the domain layer, in the Zod
schema, and by the `services_times_consistent` CHECK constraint.

### 4. Zero-distance services → not acceptable

One link of the SRS 10.3 chain is now strict:

```
start_dashboard <= start_base < end_base <= end_dashboard
                              ^ strict
```

**Only that link**, on the client's instruction to "use the best approach".
Tightening the outer two would reject a truck that begins the day already parked
at the loading base — routine and legitimate, since Start Dashboard then equals
Start Base.

Requiring `end_base > start_base` gives `serviceKm > 0` directly, and
`actualKm >= serviceKm` follows from the outer links, so `actualKm > 0` comes
free. One comparison delivers both guarantees; a unit test proves it exhaustively
over the boundary cases.

### 5. Forgotten passwords → the administrator sets a new one

No email, no reset link, no security questions. `updateUserSchema` accepts an
optional password for exactly this. Confirms the Phase 1 design; no change.

### 6. Interface language → Spanish

Every user-facing string lives in `src/lib/i18n/messages.ts` — validation
messages, error messages, status labels, field names. One file, so the client can
review the entire wording of the application without reading code.

No i18n library and no locale switching (SRS 29 excludes multi-language), but
centralising the strings costs nothing and is the seam if a second language is
ever wanted.

### 7. Administrators may create services for drivers → yes

`/services/new` is open to administrators, with a driver selector.

SRS 9.5 — "the Driver field shall always reflect the authenticated user" — now
holds for **drivers only**. The weakening is bounded: a driver's request schema
has no `driverId` field at all, so a driver still cannot file on anyone else's
behalf by any path, and every administrator-filed service records the acting
administrator separately from the owning driver in the audit log.

### 8. Free-text limits → none

Sites and Observations are unbounded in practice. A 10,000-character ceiling
remains as a guard against an oversized payload — roughly four pages, so no
driver will reach it — not as a business rule.

### 9. Session lifetime → 20 days

`SESSION_MAX_AGE_DAYS=20`. Cookies are `Secure` and `HttpOnly` over HTTPS
(SRS 22.2, 22.6). Every request re-checks `isActive` server-side, so a
deactivated account loses access immediately rather than at session expiry.

### 10. Vehicle selection → default per driver, changeable

Confirms SRS 12.5 and the Phase 1 design; no change.

---

## Still outstanding

### A. The exact Spanish field names

**Blocks:** the driver interface (Phase 3).

SRS 6.3 says the mileage field names "must be preserved in V1 because they
correspond to the client's operational workflow" — and states them in English,
while the client's own register is in Spanish. The terms currently used are a
careful translation, not the client's originals:

| SRS (English)      | Currently shown   |
| ------------------ | ----------------- |
| Start Dashboard KM | KM inicial cuadro |
| Start Base KM      | KM inicial base   |
| End Base KM        | KM final base     |
| End Dashboard KM   | KM final cuadro   |
| Actual Km          | KM reales         |
| Service Km         | KM de servicio    |
| Departure Time     | Hora de salida    |
| Arrival Time       | Hora de llegada   |
| Sites              | Sitios            |
| Observations       | Observaciones     |

**What we need:** the column headings as they appear in 01Servicios. Correcting
them is a single edit to `FIELD_LABELS` — trivial now, and progressively more
confusing for drivers the longer the wrong terms are on screen.

### B. The highest Service ID currently in use

**Blocks:** go-live, not development.

Needed for the `pnpm db:set-service-start` step under decision 2. Any number
works for development; the real one is required before the first real service is
recorded.
