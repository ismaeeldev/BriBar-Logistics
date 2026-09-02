/**
 * Declares the one environment variable read with dot notation.
 *
 * `process.env` is otherwise an index signature, which
 * `noPropertyAccessFromIndexSignature` requires be read with brackets. That
 * rule cannot apply here: Next.js inlines `NEXT_PUBLIC_*` into the client
 * bundle by statically replacing the exact expression
 * `process.env.NEXT_PUBLIC_APP_LOCALE`, and a bracket read is left untouched -
 * so it would be `undefined` in the browser and the locale would silently
 * differ between server and client render.
 *
 * Declaring the property gives the compiler a real member to check against,
 * which satisfies the rule and keeps the expression in the form the bundler
 * recognises.
 *
 * Every *other* variable is read once, validated, in `src/lib/env.ts`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** `es` (default, the client's language) or `en` (development only). */
    readonly NEXT_PUBLIC_APP_LOCALE?: 'es' | 'en';
  }
}
