import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    // Generated output and migration SQL are not ours to lint.
    'src/generated/**',
    'prisma/migrations/**',
  ]),

  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // An unused parameter is often deliberate - a handler that ignores its
      // request, a catch that ignores its error. The underscore prefix is the
      // convention for saying so on purpose.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Type-only imports must say so. Without it, importing a Prisma type can
      // drag the whole client into a bundle that only needed its shape.
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  {
    // SRS 31.1: configuration is read once, in src/lib/env.ts, and every other
    // module imports the validated object. Direct process.env reads bypass
    // that validation, and are how a deployment ends up running with a missing
    // timezone or a placeholder secret.
    files: ['src/**/*.{ts,tsx}'],
    // `src/lib/i18n/messages.ts` reads NEXT_PUBLIC_APP_LOCALE, which is not a
    // secret and must be readable from client components - the validated `env`
    // object throws in a browser by design.
    ignores: ['src/lib/env.ts', 'src/lib/logger.ts', 'src/lib/i18n/messages.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Import the validated `env` from @/lib/env instead of reading process.env directly (SRS 31.1).',
        },
      ],
    },
  },

  // Must stay last: switches off every stylistic rule that would otherwise
  // fight Prettier over formatting.
  prettier,
]);

export default eslintConfig;
