# 1. Local Docker PostgreSQL for development, Neon for deployment

**Status:** Accepted

## Context

SRS 2.3 and 19.1 make Neon PostgreSQL the sole operational database. That is a
requirement about production, not about where a developer runs migrations at
11pm on a train.

Developing directly against a Neon branch is closest to production, but it makes
every migration a network round trip, ties the test suite to connectivity and a
free-tier quota, and means a destructive `migrate reset` is one typo away from
the wrong branch.

## Decision

Local development and the integration test suite run against PostgreSQL 17 in
Docker (`docker-compose.yml`, port 5434). Staging and production run on Neon.

Two databases exist locally: `bribar` for development and `bribar_test` for the
integration suite, which truncates every table between tests.

## Consequences

Neon is plain PostgreSQL, so the schema, the migrations, the CHECK constraints
and the queries are byte-identical in both. There is no dialect risk.

What differs is operational, and the two places it shows are handled:

- **Connection pooling.** Neon's pooled endpoint is a transaction pooler, which
  cannot run DDL or hold the advisory lock Prisma Migrate takes. Hence
  `DIRECT_DATABASE_URL`, used by the CLI while the runtime uses the pooled one.
  Locally both point at the same instance, so the distinction costs nothing.
- **Compute suspension.** Neon suspends idle compute and the first query after
  wake is slow. The local instance never does, so cold-start behaviour must be
  verified on a real Neon branch before go-live, not inferred from local timings.

Port 5434 rather than the default 5432 so the container does not collide with a
PostgreSQL already installed on the machine or with another project's container.

The integration suite refuses to run unless its database name ends in `_test`.
Truncating the development database mid-session is not a mistake worth being
able to make.
