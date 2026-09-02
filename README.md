# BRIBAR Logistics

Internal web application that replaces BRIBAR Logistics' paper route sheets with
a digital workflow: a driver records a completed service on their phone, the
server calculates and stores the mileage, and an administrator approves it into
a permanent record.

Built to `BRIBAR_Logistics_V1_SRS.pdf` v1.0. Comments throughout the codebase
cite the clause a piece of behaviour implements, so a rule can be traced from
requirement to code to test.

**Status: Phases 1–3 complete** — data model, authentication, the service
layer, every API endpoint, and the full mobile-first driver interface. The
admin interface follows in Phase 4. See [`docs/roadmap.md`](docs/roadmap.md).

---

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router) + React 19, TypeScript               |
| Database   | PostgreSQL — Neon in production, Docker locally              |
| ORM        | Prisma 7 with the `pg` driver adapter                        |
| Validation | Zod 4, schemas shared by client and server                   |
| Auth       | Auth.js v5 (credentials), Argon2id hashing                   |
| Language   | Spanish interface, all strings in `src/lib/i18n/messages.ts` |
| Styling    | Tailwind CSS 4, shadcn/ui                                    |
| Tests      | Vitest — a unit project and a PostgreSQL integration project |

---

## Running it

**Prerequisites:** Node 20.19+ (22.12+ or 24+ preferred — see
[Known issues](#known-issues)), pnpm 11+, Docker Desktop.

```bash
pnpm install
```

```bash
cp .env.example .env
```

Generate the secrets `.env.example` leaves blank:

```bash
node -e "const c=require('crypto');console.log('AUTH_SECRET=\"'+c.randomBytes(48).toString('base64')+'\"');console.log('SEED_ADMIN_PASSWORD=\"'+c.randomBytes(12).toString('base64url')+'\"')"
```

Start PostgreSQL, apply the schema, and load sample data:

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
```

```bash
pnpm dev
```

The seed prints the accounts it created. `conductor1` is fully configured with a
default vehicle and three assigned routes; `conductor2` deliberately has neither,
so the "administrator configuration required" path in SRS 24.2 has something to
exercise. Sample data is skipped when `NODE_ENV=production`.

> Before go-live, continue the client's existing Service ID numbering:
> `pnpm db:set-service-start <highest number in 01Servicios>`. The seed warns
> until this is done — see [`docs/open-questions.md`](docs/open-questions.md) #2.

---

## Scripts

| Command                             | Purpose                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                          | Development server                                           |
| `pnpm build`                        | Production build (regenerates the Prisma client first)       |
| `pnpm verify`                       | `typecheck` + `lint` + unit tests — run before every commit  |
| `pnpm typecheck`                    | `tsc --noEmit`                                               |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                                       |
| `pnpm format` / `pnpm format:check` | Prettier                                                     |
| `pnpm test`                         | Unit tests (no database, ~4s)                                |
| `pnpm test:integration`             | Integration tests against PostgreSQL                         |
| `pnpm test:coverage`                | Unit coverage report                                         |
| `pnpm db:up` / `pnpm db:down`       | Start / stop the local database                              |
| `pnpm db:migrate`                   | Create and apply a migration                                 |
| `pnpm db:deploy`                    | Apply pending migrations (production)                        |
| `pnpm db:seed`                      | Bootstrap administrator, plus sample data outside production |
| `pnpm db:set-service-start <n>`     | Continue the Service ID numbering from the client's register |
| `pnpm db:reset`                     | Drop, re-migrate and re-seed                                 |
| `pnpm db:studio`                    | Prisma Studio                                                |
| `pnpm db:test:prepare`              | Migrate the isolated `bribar_test` database                  |

Integration tests need the test database migrated once:

```bash
pnpm db:test:prepare
```

---

## Layout

```
prisma/
  schema.prisma          Data model (SRS 19)
  migrations/            Versioned SQL, including hand-written CHECK constraints
  seed.ts                Bootstrap administrator and sample master data
prisma.config.ts         Prisma 7 CLI configuration

src/
  app/                   App Router pages and route handlers - kept thin
    (app)/               Authenticated shell: driver dashboard, services
    login/               Sign-in
    api/                 SRS 18 endpoints
  components/
    ui/                  Design system - native controls, no Radix
    layout/ services/ auth/
  lib/                   Cross-cutting infrastructure
    env.ts               Zod-validated configuration, parsed once at boot
    logger.ts            Structured JSON logging with secret redaction
    auth/password.ts     Argon2id hashing
    db/                  Prisma client, Prisma-error translation
    errors/              Error taxonomy and HTTP status mapping
    http/                Response envelope, route wrapper, body parsing
    time/                Business dates and clock times
    auth/                Auth.js config, session helpers, Argon2id
    audit/               Append-only audit trail with secret redaction
    i18n/                Every user-facing string, in Spanish
    utils/
  modules/               Feature modules, one per domain area
    services/
      domain/            Pure rules: mileage, times, state machine, Service ID
      schemas/           Zod request schemas
      repository/        Prisma queries - the only layer that knows the ORM
      service/           Authorisation, transactions, audit
    users/ vehicles/ routes/ shared/

proxy.ts                 Edge route protection (Next.js 16 middleware)

tests/
  unit/                  Domain and schema behaviour - no database
  integration/           Database invariants against real PostgreSQL
```

The dependency rule is one-directional: `app → modules → lib`. `domain/` imports
nothing from Prisma, Next.js or Zod, which is what lets SRS 30.1's
"calculation functions should be unit-testable independently of UI" hold.

---

## How the rules are enforced

SRS 25 tabulates each validation rule as client-side _and_ server-side. Rather
than write each rule twice, each is defined once and applied at three depths:

| Layer         | Enforces                                                   | Example                                             |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Zod schema    | Field shapes and cross-field rules, shared by form and API | `endBaseKm` cannot be below `startBaseKm`           |
| Service layer | Authorisation, and anything needing a database read        | this route is assigned to this driver               |
| PostgreSQL    | Invariants no code path may bypass                         | `actual_km = end_dashboard_km - start_dashboard_km` |

The database layer is the one worth noting. Seven `CHECK` constraints and a
partial unique index mean a service violating SRS 10.3 cannot exist, even if a
future code path forgets to validate. `tests/integration/` writes directly
through Prisma, skipping the application's own checks, and asserts the database
refuses each one anyway.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — layers, module shape, request flow
- [`docs/adr/`](docs/adr/) — decision records with the reasoning behind each choice
- [`docs/open-questions.md`](docs/open-questions.md) — **needs client input**; assumptions currently in force
- [`docs/roadmap.md`](docs/roadmap.md) — phases, and what each delivers

---

## Known issues

**Node 26.** Prisma 7.10 prints `Prisma only supports Node.js versions 20.19+,
22.12+, 24.0+` on Node 26, because 26 postdates the release. Everything works —
migrations, generation, queries, the full test suite — but the combination is
untested upstream. Node 24 LTS is the safer target for CI and production.

**Prisma's `latest` dist-tag.** It currently resolves to `8.0.0-rc`, a release
candidate. Both `prisma` and `@prisma/client` are pinned to `7.10.0` exactly.
Do not run `pnpm update` on them without checking what `latest` points at.

**pnpm and the generated client.** Prisma generates into
`node_modules/.prisma/client`, which sits outside pnpm's virtual store and
cannot resolve `@prisma/client-runtime-utils` from there. That package is
declared as a version-locked direct dependency so resolution works under pnpm's
strict layout; see [`.npmrc`](.npmrc).
