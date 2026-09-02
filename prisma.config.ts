/**
 * Prisma CLI configuration.
 *
 * Prisma 7 removed `url` and `directUrl` from the `datasource` block in
 * `schema.prisma`. Connection details for the CLI - `migrate`, `db push`,
 * `studio` - live here instead, and the runtime client gets a driver adapter
 * rather than a connection string (see `src/lib/db/prisma.ts`).
 *
 * The CLI points at `DIRECT_DATABASE_URL`, never at the pooled one. Prisma
 * Migrate takes advisory locks and issues DDL, neither of which survives a
 * transaction pooler such as the one in front of a Neon pooled endpoint. On a
 * plain local PostgreSQL the two URLs are identical and the distinction costs
 * nothing.
 */
import { existsSync } from 'node:fs';

import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads `.env` on its own. `process.loadEnvFile` is built
// into Node, so this needs no dependency.
//
// The guard matters: `pnpm test:integration` runs the CLI with `.env.test`
// already applied to the environment, and reloading `.env` here would point
// the test run at the development database.
if (!process.env['DATABASE_URL'] && existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
