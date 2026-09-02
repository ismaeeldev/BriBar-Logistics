# 5. Store calculated mileage, guarded by CHECK constraints

**Status:** Accepted

## Context

SRS 6.4 and 10.1 define two calculated values:

```
Actual Km  = End Dashboard KM - Start Dashboard KM
Service Km = End Base KM      - Start Base KM
```

SRS 6.4 says both are "calculated by server-side application logic and stored
with the service record". Storing a value derivable from other columns is
normally denormalisation, and denormalisation invites drift: a future write path
that updates a reading without recalculating leaves a record whose stated total
contradicts its own inputs.

The alternative — computing on read, or using a generated column — avoids drift
entirely but works against SRS 6.4 and 28.6, which anticipate reporting
aggregating these numbers directly.

## Decision

Store `actual_km` and `service_km`, and add CHECK constraints making drift
impossible:

```sql
CHECK (actual_km  = end_dashboard_km - start_dashboard_km)
CHECK (service_km = end_base_km      - start_base_km)
```

alongside the SRS 10.3 ordering and non-negativity constraints.

## Consequences

This is the combination that gets both properties. The values are stored, so
future reporting aggregates them with a plain `SUM` and no recomputation. And
they cannot drift, because a row where they disagree with their inputs cannot be
written by any code path — not a repository with a bug, not a migration script,
not a manual `psql` session.

It also makes SRS 22.4 unconditional. "Browser-supplied calculated values shall
not override server-owned values" normally depends on every write path
remembering to recalculate. Here, a handler that passed a client-supplied
`actualKm` straight through would be rejected by the database. The integration
suite asserts exactly this by writing through Prisma while deliberately skipping
the application's validation.

A PostgreSQL `GENERATED ALWAYS AS ... STORED` column would give the same
guarantee more elegantly, but Prisma cannot model generated columns without
dropping to raw SQL for every write to the table. The CHECK approach keeps the
whole model expressible in `schema.prisma`.

The visible cost: an update that changes a reading must also send its calculated
value, or the constraint rejects it. That is a correct constraint, not an
inconvenience — the service layer recalculates on every write (SRS 10.4), so a
rejection means a code path forgot to, which is precisely what should fail.
