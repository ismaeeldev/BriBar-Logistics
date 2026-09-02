# Open questions

Points where the SRS is silent, ambiguous, or defers to "operational
acceptability". Each has an assumption in force so development is not blocked —
but each is a place where the client's answer could change behaviour, and
several get more expensive to change once drivers are entering real data.

Ordered by how much a late answer would cost.

---

## 1. Business timezone

**SRS 31.3** requires `APP_TIMEZONE` but never names it. This decides which
calendar day a service belongs to: a service submitted at 00:30 local time is
the _previous_ day in UTC, and the wrong zone files it against the wrong date.

**Assumed:** `Europe/Lisbon`, inferred from the Portuguese place names in the
SRS's own examples.

**Cost if wrong:** low now, high later. Changing it before go-live is a
one-line environment change. Changing it afterwards means recomputing
`service_date` on existing records, and any already approved.

---

## 2. Service ID format

**SRS 19.1** requires a "human-visible Service ID" separate from the primary
key, and nothing more.

**Assumed:** `SRV-20260902-000042` — configurable prefix, the business date, and
a zero-padded value from a PostgreSQL sequence. The prefix is set by
`SERVICE_CODE_PREFIX`.

Two consequences worth confirming with the client:

- The sequence is **global, not per-day**. `SRV-20260903-000043` follows
  `SRV-20260902-000042`; the number does not reset each morning. This is what
  makes concurrent submission collision-proof (SRS 23.4) without a lock.
- **Gaps are expected.** A submission that fails validation after allocating a
  number leaves that number unused. If the client reads gaps as missing
  paperwork, they need telling.

**Cost if wrong:** low before go-live, high after — issued IDs appear on
records the business treats as authoritative.

---

## 3. Should arrival time be allowed to precede departure time?

**SRS 9.3** requires both. **SRS 31.3** says V1 "does not introduce extra
overnight-service logic". So a service departing 22:00 and arriving 02:00 is
legitimate, and a naive `arrival > departure` check would reject it.

**Assumed:** no ordering rule between the two times. Both are stored as entered.

**Consequence:** a typo — 07:45 entered as arrival and 15:30 as departure —
passes validation and reaches the administrator for review.

**Alternative if the client prefers:** warn in the UI without blocking
submission, which catches the typo without rejecting a real overnight run.

---

## 4. Are zero-distance services acceptable?

**SRS 26.3** lists "zero-distance edge case _if operationally acceptable by
validation configuration_" — explicitly deferring the decision.

**Assumed:** accepted. All four odometer readings may be equal, giving
`actualKm = 0` and `serviceKm = 0`. A cancelled or aborted run is operationally
real, and the ordering constraints use `<=` rather than `<`.

**Cost if wrong:** low. It is one comparison in the domain layer, one CHECK
constraint, and their tests.

---

## 5. How does a driver who forgets their password get back in?

**SRS 12.2** covers an administrator issuing an initial credential. Self-service
reset is not in scope, and **SRS 29** does not list it as an exclusion either —
it simply is not addressed.

**Assumed:** an administrator sets a new password through the user edit screen.
No email, no reset link, no security questions. `updateUserSchema` accepts an
optional password for exactly this.

**Worth confirming:** how the new password reaches the driver. In a two-person
deployment, verbally is fine; the answer should still be deliberate.

---

## 6. Interface language

**SRS 29** excludes a multi-language UI. It does not say which single language.
The document is in English; the operational data in it is Portuguese.

**Assumed:** English interface, with the client's own field terminology
preserved verbatim as SRS 23.3 requires — "Route/Contract", "Start Dashboard
KM", "Pending Approval".

**Cost if wrong:** moderate and rising. Retrofitting translation after the UI
is built is far more work than choosing the language before Phase 3.

---

## 7. Should administrators be able to create services?

**SRS 17.2** says of `/services/new`: "Access: DRIVER; ADMIN access may be
omitted unless explicitly needed operationally."

**Assumed:** omitted. An administrator can edit and approve any service but
cannot create one. This keeps SRS 9.5's "the Driver field shall always reflect
the authenticated user" unconditionally true — no path exists where a service's
driver is someone other than its creator.

**If the client wants it:** an administrator creating a service on a driver's
behalf needs a driver selector, which weakens that guarantee and needs its own
audit treatment. Roughly half a day, and best decided before Phase 2.

---

## 8. Free-text field limits

**SRS 6.5, 6.6** call Sites and Observations optional text with no length given.

**Assumed:** Sites 500 characters, Observations 2,000. Both stored as `TEXT`, so
raising the limit is a schema-free change to one constant.

**Cost if wrong:** negligible.

---

## 9. Session lifetime

Not addressed by the SRS. Relevant because drivers use shared phones in some
fleets.

**Assumed for Phase 2:** 30-day rolling session, matching Auth.js defaults, with
`Secure` and `HttpOnly` cookies over HTTPS (SRS 22.2, 22.6).

**Worth asking:** whether a shorter idle timeout is wanted. It trades a driver
re-entering their password against a lost phone staying signed in.

---

## 10. Vehicle selection scope

**SRS 12.5** is explicit — "a Driver may choose another active vehicle from the
available vehicle list when operationally necessary" — and rules out a
per-driver vehicle permission matrix for V1.

**Assumed:** implemented as written. Any active vehicle is selectable by any
driver.

Recorded here only because it is the kind of rule a client questions during UAT
once they see every vehicle in the dropdown. The SRS answer is unambiguous, so
changing it is a scope change, not a correction.
