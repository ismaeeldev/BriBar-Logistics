/**
 * Test configuration (SRS 26).
 *
 * Two projects, because the two kinds of test have incompatible needs and
 * running them under one config makes the fast ones as slow as the slow ones:
 *
 *   unit         Pure domain logic - mileage arithmetic, the state machine,
 *                time mapping, schema behaviour. No database, no environment,
 *                runs in milliseconds. This is the suite that runs on save.
 *
 *   integration  Anything touching PostgreSQL: the CHECK constraints, the
 *                partial unique index, the `time` column round trip. Loads
 *                `.env.test` so it can never point at the development
 *                database, and runs single-threaded because the tests share
 *                one schema.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the `@/*` alias from tsconfig.json, so tests import modules by
  // the same specifier the application uses.
  resolve: { tsconfigPaths: true },

  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          // The suite shares a single database schema, so parallel files would
          // race on truncation. Correctness beats speed here.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts'],
    },
  },
});
