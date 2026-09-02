# 8. Pin Prisma to 7.10.0 and use the `pg` driver adapter

**Status:** Accepted

## Context

Installing `prisma` resolved the CLI to `8.0.0-rc.12`, because Prisma's `latest`
dist-tag currently points at a release candidate while `@prisma/client`
resolved to stable `7.10.0`. A major-version mismatch between CLI and client is
not a supported configuration, and shipping an RC of the ORM in a client
deliverable is not defensible.

Prisma 7 also changed how connections are configured. `url` and `directUrl` are
no longer accepted in the `datasource` block; migration URLs move to
`prisma.config.ts`, and the runtime client takes a driver adapter instead of a
connection string.

## Decision

Pin both `prisma` and `@prisma/client` to exactly `7.10.0` — no caret. Use
`@prisma/adapter-pg` with an explicitly configured `pg` pool, and
`prisma.config.ts` for CLI connection details.

## Consequences

The pin is exact, so `pnpm install` cannot drift onto an RC. The README says so
explicitly, because the failure would otherwise reappear silently on someone
else's machine.

The driver adapter is a genuine improvement for this deployment rather than a
compliance step. Pool sizing is now ours to set instead of hidden inside the
query engine, which matters on the serverless hosting SRS 4.4 implies: each warm
instance holds its own pool, so `max` multiplies across instances. A low `max`
per instance is what keeps the total inside Neon's connection ceiling — the
opposite of the instinct to widen the pool for throughput.

Prisma 7 no longer loads `.env` on its own, so `prisma.config.ts` calls Node's
built-in `process.loadEnvFile` — no `dotenv` dependency. It is guarded on
`DATABASE_URL` being unset, so `pnpm test:integration`, which applies `.env.test`
before invoking the CLI, is not silently redirected at the development database.

Two consequences of the ecosystem's newness are recorded in the README rather
than fixed here:

- **Node 26.** Prisma 7.10 warns it supports 20.19+, 22.12+ and 24.0+. Everything
  works on 26 — migrations, generation, queries, the full suite — but the
  combination is untested upstream, so Node 24 LTS is the safer production target.
- **pnpm resolution.** The client generates into `node_modules/.prisma/client`,
  outside pnpm's virtual store, and cannot resolve its own
  `@prisma/client-runtime-utils` from there. It is declared as a version-locked
  direct dependency; `.npmrc` additionally hoists the `@prisma` scope.
