# 2. Layered modules with a dependency-free domain core

**Status:** Accepted

## Context

SRS 30 recommends a structure and SRS 30.1 states four separation rules: no raw
queries in components, API handlers delegate to service modules, permission
checks centralised, calculations unit-testable independently of the UI.

Behind those is SRS 1.2's real requirement — fuel, incidents, maintenance and
documents must be addable "without rebuilding the core system". That is a
statement about coupling.

The default Next.js shape works against this. Server components can query the
database directly, route handlers can hold business logic, and both are easy and
fast to write. The result is logic that exists only inside a React tree, cannot
be tested without rendering, and cannot be reused by the next module.

## Decision

Feature-first modules under `src/modules/<feature>/`, each with:

```
domain/       pure rules       - imports nothing from Prisma, Next or Zod
schemas/      Zod              - shared by the form and the route handler
repository/   Prisma only      - the sole layer that knows the ORM
service/      orchestration    - authorisation, transactions, audit
```

Dependencies point one way: `app → modules → lib`. Cross-cutting infrastructure
lives in `src/lib/`.

The alternative — layer-first (`controllers/`, `services/`, `repositories/`) —
groups files by what they _are_ rather than what they are _about_, so a change
to the approval workflow touches four distant directories. Feature-first keeps a
change local, which is the property that makes adding a module cheap.

## Consequences

The `domain/` rule is strict and load-bearing. Because `mileage.ts` and
`service-status.ts` import nothing, their tests run in milliseconds without a
database and survive any schema or framework change. SRS 30.1's
"unit-testable independently of UI" becomes structural rather than aspirational.

The cost is indirection: creating a service will pass through a route handler, a
service function and a repository. For a form with six fields that is more files
than a direct Prisma call in a server action. The trade is deliberate — the
approval workflow, the ownership rules and the audit writes are the parts that
must not be duplicated across future modules, and they are exactly what the
service layer holds.

`schemas/` sitting outside `domain/` is not an oversight. Zod is an input-parsing
concern; the rules it enforces live in `domain/` and the schema calls them. That
is why `mileageSchema` delegates to `validateMileage` instead of restating
SRS 10.3 in Zod refinements.
