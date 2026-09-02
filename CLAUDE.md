@AGENTS.md

# BRIBAR Logistics — working conventions

Built to `BRIBAR_Logistics_V1_SRS.pdf` v1.0. Read `docs/architecture.md` before
changing structure, and `docs/adr/` before revisiting a decision recorded there.

## Non-negotiables

- **Cite the clause.** Behaviour that implements an SRS requirement carries a
  comment naming it (`SRS 10.3`). This is how a rule stays traceable from
  requirement to code to test.
- **`domain/` imports nothing.** No Prisma, no Next.js, no Zod. SRS 30.1
  requires calculations to be testable without the UI, and that only holds while
  the directory stays dependency-free.
- **No `process.env` outside `src/lib/env.ts`.** ESLint enforces it. Everything
  else imports the validated `env` object.
- **No raw Prisma in components or route handlers.** Queries live in
  `repository/`; orchestration in `service/`.
- **Request schemas are `z.strictObject`.** Server-owned fields must be
  rejected, not stripped — see ADR 0007.
- **Never trust the client for** `driverId`, `status`, `actualKm`, `serviceKm`,
  `serviceCode`, `serviceDate`, or approval metadata (SRS 22.4).

## Before committing

```bash
pnpm verify
```

Run `pnpm test:integration` too when touching the schema, a migration, or
anything in `src/lib/time/`.

## Migrations

Generate with `--create-only`, then re-apply the hand-written block at the
bottom of the initial migration if the schema was regenerated: the CHECK
constraints, the partial unique index and `service_code_seq` cannot be expressed
in `schema.prisma` and will be lost otherwise.
