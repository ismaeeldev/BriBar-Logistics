/**
 * Prepares the isolated e2e database before the suite runs (SRS 31.2).
 *
 * Reuses `.env.test` — the same fixture `pnpm test:integration` runs
 * against — so the end-to-end suite never touches a developer's real data.
 * Both steps are idempotent: `migrate deploy` is a no-op once the schema is
 * current, and `db:seed` upserts every row it writes (see `prisma/seed.ts`),
 * so re-running this against an already-prepared database is safe and cheap.
 */
import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
  const run = (command: string): void => {
    execSync(command, { stdio: 'inherit', env: process.env });
  };

  run('dotenv -e .env.test -- prisma migrate deploy');
  run('dotenv -e .env.test -- prisma db seed');
}
