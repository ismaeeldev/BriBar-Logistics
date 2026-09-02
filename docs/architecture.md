# Architecture

Implements SRS 4 (System Context), 23.6 (Maintainability) and 30 (Recommended
Project Structure).

The SRS is unusually specific about structure, and for a reason worth restating:
SRS 1.2 wants a system that grows into fuel, incident, maintenance and document
modules "without rebuilding the core". That is a statement about coupling, and
it is what every decision below is answering.

---

## Layers

```
   Browser  (driver on a phone, administrator on a desktop)
       |
       v
   app/          Pages and route handlers. Thin.
       |         Reads the session, parses input, calls a service, renders.
       v
   modules/      Feature modules. Where the application actually lives.
       |           domain/      pure rules - no framework, no database
       |           schemas/     Zod, shared by form and API
       |           repository/  the only code that touches Prisma   [Phase 2]
       |           service/     orchestration, authorisation, transactions [Phase 2]
       v
   lib/          Cross-cutting infrastructure: config, errors, logging,
       |         HTTP envelope, time, Prisma client.
       v
   PostgreSQL    Neon in production. Foreign keys, CHECK constraints,
                 a partial unique index - the invariants no code may bypass.
```

Dependencies point one way: `app → modules → lib`. A module may import from
`lib` and from `modules/shared`; it should not reach into another module's
internals.

**SRS 4.3** — "Browser code shall not write directly to Neon" — holds
structurally rather than by convention: `src/lib/db/prisma.ts` imports
`src/lib/env.ts`, which throws if it is ever evaluated in a browser. A client
component that imported a repository would fail loudly at build or first render
rather than shipping database credentials to the browser.

---

## Module shape

Each feature module is a vertical slice:

```
modules/services/
  domain/            Pure business rules. No imports from Prisma, Next or Zod.
    mileage.ts         calculation + the SRS 10.3 invariants
    service-status.ts  state machine + canView / canEdit / canApprove
    service-code.ts    Service ID format
  schemas/           Zod request schemas, imported by both form and route handler
  repository/        Prisma queries. The only layer that knows the ORM.  [Phase 2]
  service/           Orchestration: authorise, validate, transact, audit. [Phase 2]
```

The split earns its keep in two specific places.

**`domain/` has no dependencies.** SRS 30.1 requires calculation functions to be
unit-testable independently of the UI. Because `mileage.ts` imports nothing, its
tests run in milliseconds and stay green through any schema or framework change.
The same applies to `service-status.ts`, which is why the permission rules in
SRS Appendix B can be asserted directly rather than inferred from HTTP responses.

**`repository/` isolates Prisma.** SRS 30.1 also forbids raw database queries in
page components. Confining Prisma to one directory per module means the ORM's
error types, its transaction client and its query shapes never leak upward — and
`src/lib/db/prisma-errors.ts` is the single place that translates its error codes
into the application's own.

---

## Where each rule lives

SRS 25 tabulates every validation rule as both client-side and server-side.
Writing each twice would guarantee eventual drift, so each rule is defined once
and enforced at the depth appropriate to it.

| Depth         | Owns                                                              | Cannot own                                             |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Zod schema    | Field shapes; cross-field rules computable from the request alone | anything needing a database read                       |
| Service layer | Authorisation, ownership, status gates, anything needing a query  | nothing structurally — this is the authoritative layer |
| PostgreSQL    | Invariants that must hold regardless of code path                 | anything requiring application context                 |

The mileage sequence is the clearest example. `validateMileage` in `domain/`
states SRS 10.3 once. `mileageSchema` calls it, so the driver's form and the API
apply the identical rule. The migration then adds
`CHECK (start_dashboard_km <= start_base_km <= end_base_km <= end_dashboard_km)`,
so a row breaking it cannot be written even by a script that never loads the
application.

That third layer is not belt-and-braces for its own sake. SRS 22.4 requires that
browser-supplied calculations never override server-owned values; the
`services_actual_km_formula` constraint makes that unconditional rather than
dependent on every future write path remembering to recalculate.

---

## Errors and the HTTP contract

A route handler throws; it never assembles an error response.

```ts
export const POST = withRouteHandler(async (request) => {
  const actor = await requireAdmin(); // throws forbidden()
  const input = await parseJsonBody(request, createVehicleSchema); // throws validationFailed()
  return created(await vehicleService.create(actor, input));
});
```

`withRouteHandler` catches everything and maps it:

| Thrown                      | Response                                             |
| --------------------------- | ---------------------------------------------------- |
| `AppError`                  | its own status, with a message written for a human   |
| `ZodError`                  | 400 with `fieldErrors` keyed by field path           |
| Prisma constraint violation | translated by `prisma-errors.ts` — 409, 400 or 404   |
| anything else               | 500, generic message, full detail logged server-side |

The last row is SRS 24.5. An unexpected failure tells the user nothing about the
implementation; the stack trace goes to the log, redacted of anything matching a
credential-shaped key.

Every response has the same shape, so a client narrows on one key:

```jsonc
{ "data": { … }, "meta": { … } }
{ "error": { "code": "CONFLICT", "message": "…", "fieldErrors": { … } } }
```

`fieldErrors` is keyed by the path the client submitted (`assignments.0.routeId`),
which is also how react-hook-form names its inputs — so server-side validation
lands on the right field with no translation step.

---

## Time

Three different things get called "time" here, and conflating them files records
against the wrong day.

| Concept                                     | Column        | Stored                | Rendered       |
| ------------------------------------------- | ------------- | --------------------- | -------------- |
| Audit instant (`created_at`, `approved_at`) | `timestamptz` | UTC                   | `APP_TIMEZONE` |
| Business date (`service_date`)              | `date`        | calendar day, no zone | as stored      |
| Clock reading (`departure_time`)            | `time`        | wall-clock, no zone   | as stored      |

A service submitted at 00:30 in Lisbon is 23:30 UTC on the previous day.
`businessDateFor` converts through `APP_TIMEZONE` before taking the calendar
day, so it lands on the right one.

`departure_time` and `arrival_time` are the subtler case. PostgreSQL's `time`
models a wall-clock reading exactly, but JavaScript has no time-only type, so
Prisma surfaces the column as a `Date` pinned to 1970-01-01. Every `Date`
accessor except the UTC ones applies the server's local offset, which would
shift every stored time by that offset. `src/lib/time/time-of-day.ts` is the
boundary: above it, times are `"HH:MM"` strings; only its two mappers touch the
`Date` form, and only through UTC accessors. An integration test asserts the
round trip against a real column.

---

## Extension points

SRS 28 lists modules V1 must not block. Each lands as a new directory under
`modules/` plus new tables — no change to the ones here.

| Future module             | Attaches to                                 | Blocked by anything?                                                                |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fuel / refuelling (28.1)  | driver, vehicle, date, optionally a service | no                                                                                  |
| Incidents (28.2)          | driver, vehicle, service, documents         | no                                                                                  |
| Maintenance (28.3)        | vehicle, mileage, cost                      | no                                                                                  |
| Documents (28.4)          | any entity, with expiry metadata            | no                                                                                  |
| Reporting / export (28.6) | reads `services`                            | no — `actual_km` and `service_km` are stored, so aggregation needs no recomputation |

Two design choices carry most of that weight. `service_status_history` means a
new workflow state (a rejection step, a two-stage approval) is a row in
`SERVICE_TRANSITIONS` and an enum value, not a redesign of `services` — SRS 21.2
asks for exactly this. And `audit_logs` is entity-agnostic: a new module is a new
value in `AuditEntityType`, not a new audit mechanism.
