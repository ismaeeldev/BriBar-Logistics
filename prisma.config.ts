/**
 * Prisma CLI configuration.
 *
 * Prisma 7 removed `url` and `directUrl` from the `datasource` block in
 * `schema.prisma`. Connection details for the CLI - `migrate`, `db push`,
 * `studio` - live here instead, and the runtime client gets a driver adapter
 * rather than a connection string (see `src/lib/db/prisma.ts`).
 *
 * The CLI prefers `DIRECT_DATABASE_URL` - Prisma Migrate takes advisory locks
 * and issues DDL, neither of which survives a transaction pooler such as the
 * one in front of a Neon pooled endpoint - but falls back to `DATABASE_URL`
 * when only that is set, matching `src/lib/env.ts`. On a plain local PostgreSQL
 * the two URLs are identical and the distinction costs nothing.
 *
 * The fallback matters on Vercel: the build runs `prisma generate`, which loads
 * this file but needs no database connection at all. Hard-requiring
 * `DIRECT_DATABASE_URL` there would fail the build for a variable nothing in
 * the build actually uses.
 */
import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads `.env` on its own. `process.loadEnvFile` is built
// into Node, so this needs no dependency.
//
// The guard matters: `pnpm test:integration` runs the CLI with `.env.test`
// already applied to the environment, and reloading `.env` here would point
// the test run at the development database.
if (!process.env['DATABASE_URL'] && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const migrationUrl = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (!migrationUrl) {
  throw new Error(
    'Neither DIRECT_DATABASE_URL nor DATABASE_URL is set. A Prisma CLI command ' +
      'needs one of them; see .env.example.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: migrationUrl,
  },

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
