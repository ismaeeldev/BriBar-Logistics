/**
 * Playwright configuration for the end-to-end suite (SRS 26).
 *
 * The suite runs against the same isolated fixture `pnpm test:integration`
 * uses — `.env.test`, pointing at the `bribar_test` database — never against
 * a developer's real data. `globalSetup` applies migrations and re-seeds that
 * database before every run, and both operations are idempotent, so running
 * this back-to-back or on a clean checkout both just work.
 *
 * A dedicated port (3100 by default) keeps this from colliding with a `pnpm
 * dev` server the developer may already have open on 3000.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env['E2E_PORT'] ?? '3100';
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // The suite shares one seeded database rather than a transaction per test,
  // so specs run in one worker: two vehicles created in parallel with the
  // same generated plate would otherwise race the unique constraint.
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,

  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // A desktop viewport throughout: several admin screens (the sidebar,
      // the desktop topbar and its sign-out button) only render at `lg`
      // (1024px), and `ResponsiveList` renders a card *and* a table for every
      // row and lets CSS pick — a narrow viewport would leave both the table
      // and its accessible roles out of the picture.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  // Reuses a server the developer already has running on this port locally
  // (handy with `test:e2e:ui`), but never in CI, where a stale server must
  // not be able to hide a broken build.
  webServer: {
    command: `pnpm exec dotenv -e .env.test -- next dev -H 127.0.0.1 -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
