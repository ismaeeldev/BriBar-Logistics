# Roadmap

Six phases, ~32 developer-days. Phase sizes match the costed plan; each ends at
something demonstrable rather than at a file count.

| Phase | Scope                                      | Days | Status       |
| ----- | ------------------------------------------ | ---- | ------------ |
| 1     | Setup and data model                       | 3.0  | **Complete** |
| 2     | Auth, authorisation, domain services, APIs | 7.5  | Next         |
| 3     | Driver UI                                  | 4.0  |              |
| 4     | Admin UI                                   | 4.5  |              |
| 5     | Polish and testing                         | 5.0  |              |
| 6     | Deploy, UAT, handover                      | 3.0  |              |

---

## Phase 1 — Setup and data model ✅

**Delivered**

- Next.js 16 / React 19 / TypeScript scaffold, strict compiler settings beyond
  `strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`), ESLint + Prettier, Vitest.
- Complete Prisma schema for SRS 19 — 7 models, 4 enums, 19 indexes.
- Initial migration, including hand-written SQL the schema language cannot
  express: 7 CHECK constraints, a partial unique index for "one default route
  per driver", and the Service ID sequence.
- `src/lib/env.ts` — Zod-validated configuration, parsed once at boot, rejecting
  placeholder secrets and invalid timezones.
- Error taxonomy and HTTP contract: `AppError`, status mapping, Prisma error
  translation, `withRouteHandler`, `parseJsonBody`, `parseSearchParams`.
- Structured logging with credential redaction.
- Domain core: mileage calculation and the SRS 10.3 invariants, the service
  state machine and permission predicates, Service ID formatting.
- Zod schemas for every entity, shared client/server, strict against mass
  assignment.
- Argon2id password hashing.
- Time handling: business dates in `APP_TIMEZONE`, clock times through a single
  mapper.
- Seed script — bootstrap administrator in every environment, sample master data
  outside production.
- **123 tests** — 96 unit, 27 integration against real PostgreSQL.
- README, architecture notes, 8 decision records, open-questions list.

**Verified:** `pnpm verify` clean; `pnpm test:integration` green; `pnpm build`
succeeds.

**Not in Phase 1:** anything requiring a session. No login, no API routes, no UI
beyond a redirect stub. That is Phase 2's boundary, not an omission.

---

## Phase 2 — Auth, authorisation, domain services, APIs (7.5 days)

The largest phase, and the one that carries the security requirements. Roughly
28% of the build is this layer — the part a client cannot see, and the part that
stops a driver editing an approved record with a raw HTTP call.

- Auth.js v5 credentials provider, split edge/Node config; login page; session
  callbacks carrying role and active state.
- Route protection in middleware, re-checked server-side per SRS 8.3.
- Session helpers: `requireUser`, `requireAdmin`, `requireDriver`.
- Repository layer per module.
- Service layer: create/update/approve with authorisation, transactions and
  audit writes.
- Add Service context endpoint (SRS 18.3) — default vehicle, assigned routes,
  default route, configuration-required states.
- All API routes from SRS 18.
- Audit service with redaction.
- Integration tests for every row of the SRS 20 permissions matrix and every
  case in SRS 26.4 and 26.8.

**Ends at:** the whole workflow demonstrable over HTTP, with no interface.

---

## Phase 3 — Driver UI (4.0 days)

- shadcn/ui setup, design tokens, mobile-first layout.
- Login, driver dashboard, Add Service form, service list, service detail, edit.
- Live calculated-mileage preview, recomputed server-side on submit.
- Empty, loading, error and configuration-required states (SRS 24.2).
- Verified at real phone viewport widths (SRS 26.7).

---

## Phase 4 — Admin UI (4.5 days)

- Admin dashboard with the approval queue.
- Services list with all five filters (SRS 16.3), service detail with audit
  metadata, approve and edit.
- Users: list, create, edit, activate/deactivate, default vehicle, route
  assignment with default selection.
- Vehicles and routes: full CRUD with deactivation.

---

## Phase 5 — Polish and testing (5.0 days)

- Accessibility pass (SRS 23.10) — labels, focus order, contrast, keyboard.
- Concurrency tests (SRS 26.6) including the SRS 24.4 approve-during-edit race.
- Performance: query plans against the indexes, pagination under volume.
- Full pass over the SRS 27 acceptance criteria, all 22.
- Error-state and empty-state review across every page.

---

## Phase 6 — Deploy, UAT, handover (3.0 days)

- Neon project and branches; production migration and secure bootstrap.
- Hosting, private BRIBAR subdomain, TLS.
- Error monitoring.
- UAT against SRS 27 with the client.
- Handover: runbook, admin guide, credential rotation.

---

## Excluded from V1

Everything in SRS 29 — Excel and M365 integration, fuel, incidents,
maintenance, documents, reporting and export, GPS, native apps, offline/PWA,
multi-stage approval. Plus self-service password reset, a rejection state, and a
multi-language interface.

Each is a separate quote. CSV export in particular is not the small addition it
sounds like: with the admin filters applied it is 1.5–2 days, not an afternoon.
