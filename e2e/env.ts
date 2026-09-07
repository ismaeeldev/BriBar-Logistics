/**
 * Credentials for the e2e suite, read from `.env.test` (SRS 22.5).
 *
 * The Playwright runner is a separate Node process from the Next.js server
 * the `webServer` block starts — it does not inherit whatever `dotenv -e
 * .env.test` injects into that child process — so the fixture is read again
 * here. `.env.test` carries no real secret (see `.gitignore`'s note by the
 * same name): it is a tracked fixture, and reading it back is not a leak.
 *
 * An environment variable set on the process running Playwright itself
 * always wins, so `SEED_ADMIN_PASSWORD=... pnpm test:e2e` still works against
 * a database seeded some other way.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) value = value.slice(1, -1);

    values[key] = value;
  }
  return values;
}

const testEnv = loadEnvFile(resolve(process.cwd(), '.env.test'));

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? testEnv[name] ?? fallback;
  if (!value) {
    throw new Error(
      `${name} is not set. The e2e suite reads it from the environment or ` +
        '.env.test (already tracked in the repo) — see prisma/seed.ts.',
    );
  }
  return value;
}

/** The bootstrap administrator `globalSetup` seeds via `.env.test`. */
export const ADMIN_LOGIN = required('SEED_ADMIN_LOGIN', 'admin');
export const ADMIN_PASSWORD = required('SEED_ADMIN_PASSWORD');

/**
 * The configured demo driver `prisma/seed.ts` always creates outside
 * production — one default vehicle, one default route, two more assigned
 * (see `seedSampleData`). `.env.test` has `NODE_ENV` unset, so sample data is
 * always seeded there.
 */
export const DRIVER_LOGIN = 'conductor1';
export const DRIVER_PASSWORD = required('SEED_DRIVER_PASSWORD', 'driver-local-dev-2026');

/** A value unique to this run, so records created by one run of the suite
 * never collide with a previous one against the same database. */
export function uniqueSuffix(): string {
  return Date.now().toString(36).slice(-6).toUpperCase();
}
