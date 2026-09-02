/**
 * Validated application configuration (SRS 31.1).
 *
 * Every environment variable the application depends on is declared here once,
 * parsed with Zod, and exported as a frozen, fully typed object. Nothing else
 * in the codebase reads `process.env` directly.
 *
 * The parse runs at module load, so a misconfigured deployment fails at boot
 * with a readable list of problems instead of throwing a `undefined is not a
 * string` somewhere inside a request three hours later.
 */
import { z } from 'zod';

/**
 * `Intl` is the only reliable IANA timezone database available at runtime.
 * Constructing a formatter is the cheapest way to ask it whether a zone name
 * is real.
 */
function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Values that look like a secret but are not one. A deployment that ships with
 * any of these has forgotten to run `openssl rand`, and refusing to start is
 * far safer than signing sessions with a guessable key (SRS 22.2, 22.5).
 */
const PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'change-me',
  'secret',
  'your-secret-here',
  'auth-secret',
  'todo',
]);

const postgresUrl = z
  .string()
  .min(1, 'is required')
  .refine(
    (value) => /^postgres(ql)?:\/\//i.test(value),
    'must be a postgresql:// connection string',
  );

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Neon PostgreSQL in staging/production, local Docker in development.
   * Prefer Neon's pooled host here so serverless invocations do not exhaust
   * connections.
   */
  DATABASE_URL: postgresUrl,

  /**
   * Direct, non-pooled connection used by Prisma Migrate, which cannot run DDL
   * through a transaction pooler. Falls back to DATABASE_URL, which is correct
   * for a plain local PostgreSQL instance.
   */
  DIRECT_DATABASE_URL: postgresUrl.optional(),

  /** Auth.js session signing key. */
  AUTH_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters; generate with `openssl rand -base64 48`')
    .refine(
      (value) => !PLACEHOLDER_SECRETS.has(value.trim().toLowerCase()),
      'is a placeholder value and must be replaced with a generated secret',
    ),

  /** Canonical origin, needed by Auth.js to build callback URLs. */
  AUTH_URL: z.url('must be an absolute URL, e.g. https://logistics.bribar.example').optional(),

  /**
   * Session lifetime in days (client decision #9). Also the JWT max age, so a
   * deactivated user is locked out at the next session refresh at the latest;
   * every request additionally re-checks `isActive` server-side (SRS 8.3).
   */
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(20),

  /**
   * IANA zone driving every business-facing date (SRS 31.3). Audit timestamps
   * are always UTC; this only decides which calendar day a service belongs to
   * and how timestamps are rendered.
   */
  APP_TIMEZONE: z
    .string()
    .min(1, 'is required')
    .refine(isValidTimeZone, 'must be a valid IANA timezone, e.g. Europe/Madrid'),

  /** Bootstrap administrator, consumed only by `prisma/seed.ts` (SRS 31.2). */
  SEED_ADMIN_NAME: z.string().min(1).default('BRIBAR Administrator'),
  SEED_ADMIN_LOGIN: z.string().min(1).default('admin'),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const envSchema = baseEnvSchema
  .transform((value) => ({
    ...value,
    // Resolved rather than left undefined so callers never repeat the fallback.
    DIRECT_DATABASE_URL: value.DIRECT_DATABASE_URL ?? value.DATABASE_URL,
  }))
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    // In production the callback origin cannot be inferred safely, and it must
    // be HTTPS because the session cookie is `Secure` (SRS 22.6).
    if (!value.AUTH_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_URL'],
        message: 'is required in production',
      });
    } else if (!value.AUTH_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_URL'],
        message: 'must use https in production (SRS 22.6)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const name = issue.path.join('.') || '(root)';
      return `  - ${name}: ${issue.message}`;
    })
    .join('\n');
}

function loadEnv(): Env {
  // Escape hatch for build steps that compile the app without runtime secrets
  // present (container image builds, type-checking in CI).
  if (process.env['SKIP_ENV_VALIDATION'] === '1') {
    return process.env as unknown as Env;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      'Invalid environment configuration. Fix the following and restart:\n' +
        formatIssues(parsed.error) +
        '\n\nSee .env.example for the full list of supported variables.',
    );
  }

  return Object.freeze(parsed.data);
}

/**
 * The validated configuration.
 *
 * Server-only by construction: it reads secrets from `process.env`, which
 * Next.js never exposes to the browser bundle unless the name is prefixed
 * `NEXT_PUBLIC_`. The guard below turns a mistaken client import into an
 * obvious error rather than a silently `undefined` config object.
 */
export const env: Env = (() => {
  if (typeof window !== 'undefined') {
    throw new Error(
      '`src/lib/env.ts` was imported from client code. Server configuration ' +
        'must never reach the browser bundle (SRS 26.8).',
    );
  }
  return loadEnv();
})();
