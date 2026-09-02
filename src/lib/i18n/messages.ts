/**
 * Every string a user can see, in one place.
 *
 * The interface language is Spanish (client decision, `docs/open-questions.md`
 * #6). SRS 29 excludes a multi-language UI, so there is **no language switcher
 * in the application** and none should be added: the client asked for one
 * language and a toggle in the product would be a feature they did not buy.
 *
 * English exists as a *development* locale. The people building and reviewing
 * this system need to read what they are checking - a behaviour you cannot read
 * is a behaviour you cannot verify - and a locale chosen by an environment
 * variable serves that without shipping a switcher.
 *
 *     pnpm dev        Spanish, the client's language and the default
 *     pnpm dev:en     English, for development and review
 *
 * Nothing else in the codebase changes: this module re-exports the selected
 * dictionary under the same names it always used, so all 29 consumers are
 * unaware there is more than one locale.
 */
import type { Dictionary } from './dictionary';
import { en } from './locales/en';
import { es } from './locales/es';

export type Locale = 'es' | 'en';

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

/**
 * `NEXT_PUBLIC_` rather than the validated `env` object, and deliberately so.
 *
 * This module is imported by client components - the service form reads
 * `FIELD_LABELS` - and `src/lib/env.ts` throws by design if it is ever
 * evaluated in a browser. A `NEXT_PUBLIC_` variable is inlined into the client
 * bundle at build time, which is exactly the mechanism a client-visible
 * setting needs. It holds no secret, so exposing it costs nothing.
 *
 * Anything other than `en` falls back to Spanish, so a typo in the environment
 * cannot put the client's deployment into a language they did not ask for.
 */
function resolveLocale(): Locale {
  return process.env.NEXT_PUBLIC_APP_LOCALE === 'en' ? 'en' : 'es';
}

export const LOCALE: Locale = resolveLocale();

const dictionary = DICTIONARIES[LOCALE];

export const {
  FIELD_LABELS,
  SERVICE_STATUS_LABELS,
  ROLE_LABELS,
  MILEAGE_VIOLATION_MESSAGES,
  SERVICE_TIME_VIOLATION_MESSAGES,
  VALIDATION,
  ERRORS,
  CONSTRAINT_MESSAGES,
  AUTH,
  UI,
} = dictionary;

/**
 * The tag `Intl` groups digits by.
 *
 * Distinct from `LOCALE` on purpose: `Intl` needs a region to know that Spanish
 * writes 1.234 and English writes 1,234, and a bare 'es' would leave that to
 * whatever the server happens to be configured with.
 */
export const NUMBER_LOCALE = LOCALE === 'en' ? 'en-GB' : 'es-ES';

export type FieldKey = keyof Dictionary['FIELD_LABELS'];
export type { Dictionary };
