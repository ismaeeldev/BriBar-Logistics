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

## Phase 2 — Auth, authorisation, domain services, APIs ✅

The largest phase, and the one carrying the security requirements — roughly 28%
of the build, and the part a client cannot see.

**Delivered**

- Auth.js v5 credentials provider with Argon2id, split Edge/Node config so the
  proxy can authorise on the Edge without pulling Prisma into that bundle.
- Sign-in page with distinct invalid-credential and deactivated-account states
  (SRS 17.1), and a constant-time dummy hash so the form cannot be used to
  enumerate accounts.
- `requireUser` / `requireAdmin` / `requireDriver`, each re-reading the user
  from the database so a deactivated account loses access immediately rather
  than at token expiry (SRS 8.3, 12.4).
- Route protection in `proxy.ts`, re-checked in every handler.
- Repositories for services, users, vehicles and routes. Ownership scoping is
  pushed into SQL, so a driver's query cannot return another driver's row.
- Service layer with authorisation, transactions and audit writes: create,
  edit, approve, and the Add Service context.
- Audit service with secret redaction and field-level diffs.
- All 13 API endpoints from SRS 18, plus presenters that keep Prisma rows off
  the wire.
- Driver and admin dashboard stubs proving the role-scoped read path.

**Verified:** 234 tests — 129 unit, 105 integration. `pnpm verify` clean,
`pnpm build` succeeds.

**Notable during the build**

- Prisma's `updateMany` cannot express a relation connect; the repository type
  now says so rather than accepting a wider input and casting. The cast
  compiled and failed at runtime — the integration tests caught it.
- `translatePrismaError` originally ran only in the HTTP wrapper, so a server
  component calling a service directly would have received a raw ORM error.
  Translation moved into the service layer, making `AppError` the contract
  whatever the caller.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`.

## Phase 3 — Driver UI ✅

**Delivered**

- OKLCH design token system with a full dark theme; tabular figures
  throughout, since odometer readings and Service IDs sit in columns.
- A tailored component layer, no Radix and no new dependencies. Every form
  control is native, which is what SRS 9.5 asks for: `<select>` opens the OS
  picker, `<input type="time">` the OS time picker, `inputMode="numeric"` the
  numeric keypad.
- Sign-in, driver dashboard, Add Service, history with status filters and
  pagination, service detail, edit. Plus 404, error and loading states.
- Live calculated mileage using the same domain functions the server uses, so
  the preview cannot disagree with what is stored (SRS 10.2).
- 44px minimum touch targets, 52px primary actions, 16px input text so iOS
  does not zoom on focus, sticky action bar clear of the home indicator.
- Configuration-required state for an unconfigured driver (SRS 24.2).

**Verified in a real browser at 375px**, in both themes: sign-in, the full
create round trip, the route-change origin/destination refresh, the live
preview, a rejected same-day time pair, and the same service accepted once
flagged overnight.

**Three bugs that only a browser would have found**

- `trustHost` unset — sign-in succeeded, then every later request reported no
  session. Required for any non-Vercel host, including the client's subdomain.
- A `Date` passed to a client component crashed hydration; the page rendered
  server-side and the form still submitted, so the only symptom was a dead
  live preview. Client components now take a serialisable DTO.
- A validation failure lost the odometer readings, against SRS 24.1. The
  action now echoes submitted values back with the errors.

## Phase 4 — Admin UI ✅

**Delivered**

- Dashboard led by the approval queue, as SRS 16.1 requires — master-data
  links live in the nav bar rather than as tiles, so the queue is never pushed
  below the fold.
- Services list with all five SRS 16.3 filters (date range, driver, vehicle,
  route, status). Filter state lives in the URL, so a filtered view is
  shareable and survives back-navigation, and the query is parsed with the
  same schema `/api/services` uses.
- Service review with every field SRS 16.4 enumerates, plus the status
  history. Approve with confirmation, since approval is irreversible
  (SRS 11.4) and a misplaced tap should not lock a record.
- Admin service edit, reusing the driver's form with the owner's context and
  a warning when the service is already approved (SRS 21.3).
- Users: list, create, edit, activate/deactivate, default vehicle, and route
  assignment with a checkbox per route and one radio for the default —
  a radio group expresses "at most one" natively (SRS 12.6). An administrator
  cannot demote or deactivate themselves.
- Vehicles and routes: full CRUD with deactivation. No delete anywhere; the
  `onDelete: Restrict` foreign keys would refuse it regardless (SRS 21.5).

**Verified in a real browser**: sign-in as administrator, the approval round
trip (including the recorded approver, timestamp and status history), the
status filter, vehicle creation with plate normalisation, moving a driver's
default route between routes, and the self-edit guard.

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
