# 9. One message catalogue rather than inline Spanish strings

**Status:** Accepted

## Context

The client confirmed the interface language is Spanish
(`docs/open-questions.md` #6). SRS 29 excludes a multi-language UI, so there is
exactly one locale and no switching requirement.

The cheapest thing that satisfies that is to write Spanish strings inline
wherever a message is needed — in Zod schemas, in error factories, in components.
An i18n library (next-intl, react-i18next) is the other extreme, and would add a
dependency, a build step and a key-indirection layer for a feature the SRS
explicitly rules out.

## Decision

Neither. All user-facing text lives in `src/lib/i18n/messages.ts` as plain
exported constants — field labels, validation messages, error messages, status
labels, constraint messages. No library, no key lookup at runtime, no locale
negotiation.

The domain layer returns violation _codes_ and field names; the message lookup
happens at the schema boundary. That division is what keeps
`modules/services/domain/` free of every dependency, this file included.

## Consequences

The reason this is worth more than inline strings has little to do with
translation.

**The client can review the wording.** SRS 23.3 requires the client's own
operational terminology, and SRS 6.3 goes further — the mileage field names "must
be preserved because they correspond to the client's operational workflow". Those
terms are currently a translation from the SRS's English, not the client's
originals from their Spanish register. Correcting them is one edit to
`FIELD_LABELS`; scattered inline, it would be a search across every schema and
component with no way to be sure it was complete.

**Wording stays consistent.** "KM inicial base" appears in a field label, a
validation message, and a database-constraint message. Composed from one constant,
the three cannot drift.

**Nothing is lost if translation is ever wanted.** This file is the seam. Adding a
second locale means changing the constants into a keyed lookup, not hunting for
strings.

The cost is one indirection between a schema and its message, and a small amount
of ceremony in the domain layer — returning `{ code, field }` instead of a
sentence. That ceremony is what buys the dependency-free domain, so it would have
been worth having regardless.
