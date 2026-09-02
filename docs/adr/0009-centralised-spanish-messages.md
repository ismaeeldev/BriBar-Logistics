# 9. One message catalogue rather than inline strings

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

**Nothing is lost if translation is ever wanted.** That seam was used sooner
than expected. The developer building and reviewing the system does not read
Spanish, and a behaviour you cannot read is a behaviour you cannot verify — so
`src/lib/i18n/locales/en.ts` now mirrors the Spanish dictionary, selected by
`NEXT_PUBLIC_APP_LOCALE` (`pnpm dev:en`).

It is a development locale, not a product feature: SRS 29 excludes a
multi-language interface, so there is deliberately **no switcher in the
application** and Spanish is the default everywhere, including any production
build. A `Dictionary` interface binds the two together, so adding a string to
one locale without the other is a compile error rather than a page rendering a
missing key.

Adding English also forced the file to become what this ADR always claimed it
was. Twenty-eight components still held their own inline strings — headings,
buttons, hints, empty states — so "the client can review the entire wording in
one file" was not yet true. It is now.

The cost is one indirection between a schema and its message, and a small amount
of ceremony in the domain layer — returning `{ code, field }` instead of a
sentence. That ceremony is what buys the dependency-free domain, so it would have
been worth having regardless.
