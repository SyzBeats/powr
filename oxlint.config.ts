import { defineConfig, type DummyRuleMap, type OxlintConfig } from 'oxlint';

/**
 * Lint and layer rules (ADR-0017, ADR-0001, technical concept §5.2).
 * Each file matches at most one override that sets `no-restricted-imports`, because a later
 * override replaces (does not merge) the options of an earlier one.
 */

const UI_FRAMEWORKS = ['react', 'react-dom', 'react/*', 'react-dom/*', '@base-ui/*', '@tanstack/*'];
const STORAGE_LIBS = ['dexie', 'dexie/*', 'dexie-react-hooks'];

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
];

type RuleSetting<K extends keyof DummyRuleMap> = Exclude<DummyRuleMap[K], undefined>;

type ImportPattern = ({ group: string[] } | { regex: string }) & {
  message: string;
  allowTypeImports?: boolean;
};

const restrict = (...patterns: ImportPattern[]): RuleSetting<'no-restricted-imports'> => [
  'error',
  { patterns },
];

/**
 * The backup code path (Zod record schemas, fflate) is a lazy chunk (§8.19). oxlint also checks
 * `import()`, so the single loader in src/hooks/use-data.ts carries the one disable comment; type
 * imports are erased and allowed. Part of every app override below.
 */
const LAZY_BACKUP: ImportPattern = {
  regex: '^@powr/(application|formats)/backup$',
  allowTypeImports: true,
  message: "The backup code path is lazy-loaded: use import('@powr/application/backup').",
};

/** The bare package only; gitignore-style groups would also match a local `./zod` module. */
const ZOD_PACKAGE = '^zod(/.*)?$';

/**
 * The design system's subpath-import alias (`#ui/*`, apps/web/package.json `imports`, ADR-0003).
 * A regex, because `#` starts a comment in the gitignore-style `group` patterns.
 */
const UI_ALIAS = '^#ui(/.*)?$';

const browserGlobalsBanned = (reason: string): RuleSetting<'no-restricted-globals'> => [
  'error',
  ...BROWSER_GLOBALS.map((name) => ({ name, message: reason })),
];

const config: OxlintConfig = {
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'jsx-a11y', 'import', 'vitest'],
  jsPlugins: [
    // Alpha JS plugins: warnings only until oxlint JS plugins are stable (OQ-T10).
    'eslint-plugin-lingui',
    { name: 'react-hooks-js', specifier: 'eslint-plugin-react-hooks' },
  ],
  categories: {
    correctness: 'error',
    suspicious: 'warn',
  },
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: 'warn',
  },
  settings: {
    react: { version: '19.3' },
  },
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/dev-dist/**',
    '.tsbuild/**',
    '**/routeTree.gen.ts',
    'apps/web/src/i18n/locales/**',
    'apps/web/playwright-report/**',
    'apps/web/test-results/**',
    'tools/licence/fixtures/**',
  ],
  rules: {
    'import/no-cycle': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/await-thenable': 'error',
    'typescript/consistent-type-imports': 'error',
    'eslint/no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'error',
    'react/no-danger': 'error',
    // Design-system inputs (src/ui) render a native <input>; wrapping labels may contain them.
    'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['Input'] }],
    // Branded IDs (ExerciseId, SessionId …) are created by assertion at trusted boundaries.
    'typescript/no-unsafe-type-assertion': 'off',
    // The automatic JSX runtime needs no React import.
    'react/react-in-jsx-scope': 'off',
    'eslint/no-underscore-dangle': [
      'warn',
      {
        allow: [
          '__APP_VERSION__',
          '__APP_BUILD__',
          '__RELEASE_TARGET__',
          '__WB_MANIFEST',
          '__brand',
        ],
      },
    ],
    'import/no-unassigned-import': ['warn', { allow: ['**/*.css', 'fake-indexeddb/auto'] }],
    // Its fix targets window.postMessage; we only post to workers and service workers.
    'unicorn/require-post-message-target-origin': 'off',
  },
  overrides: [
    {
      // Pure engine: no framework, no I/O, no ambient time or randomness (§8.7.1).
      files: ['packages/domain/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: [...UI_FRAMEWORKS, ...STORAGE_LIBS], message: 'The domain is framework-free.' },
          { group: ['zod', 'zod/*'], message: 'Validation lives in rules, content and formats.' },
          { group: ['@powr/*'], message: 'The domain depends on no internal package.' },
        ),
        'no-restricted-globals': [
          'error',
          ...['Date', 'performance', 'crypto', 'setTimeout', 'setInterval', ...BROWSER_GLOBALS].map(
            (name) => ({ name, message: 'Time, IDs and I/O are passed in as arguments (§8.7.1).' }),
          ),
        ],
        'no-restricted-properties': [
          'error',
          { object: 'Math', property: 'random', message: 'Use a seeded PRNG passed in.' },
        ],
      },
    },
    {
      files: ['packages/rules/**', 'packages/content/**', 'packages/formats/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: [...UI_FRAMEWORKS, ...STORAGE_LIBS], message: 'Packages are framework-free.' },
          { group: ['@powr/application', '@powr/web'], message: 'Dependencies point inward.' },
          {
            regex: ZOD_PACKAGE,
            message: "Import z from the package's ./zod module (JIT-less for the CSP).",
          },
        ),
        'no-restricted-globals': browserGlobalsBanned('Packages do no I/O.'),
      },
    },
    {
      files: ['packages/application/**'],
      rules: {
        'no-restricted-imports': restrict(
          {
            group: [...UI_FRAMEWORKS, ...STORAGE_LIBS],
            message: 'Use cases reach storage and UI only through ports.',
          },
          {
            group: ['fflate', 'zod', 'zod/*'],
            message: 'Codecs and schemas live in @powr/formats.',
          },
        ),
        'no-restricted-globals': browserGlobalsBanned('Browser APIs are reached through ports.'),
      },
    },
    {
      files: ['apps/web/src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': restrict(LAZY_BACKUP),
        // Blocking: literal text in JSX and on text attributes must go through Lingui (§8.15).
        'react/jsx-no-literals': [
          'error',
          {
            noStrings: false,
            restrictedAttributes: ['aria-label', 'title', 'placeholder', 'alt', 'label'],
            allowedStrings: ['·', '×', '–', '—', '-', '/', '%', ':', '+', '−', '…'],
            elementOverrides: { Trans: { allowElement: true }, Plural: { allowElement: true } },
          },
        ],
        'react-hooks-js/purity': 'warn',
        'react-hooks-js/refs': 'warn',
        'react-hooks-js/immutability': 'warn',
        'react-hooks-js/set-state-in-render': 'warn',
        'react-hooks-js/set-state-in-effect': 'warn',
        'react-hooks-js/static-components': 'warn',
        'react-hooks-js/use-memo': 'warn',
        'react-hooks-js/preserve-manual-memoization': 'warn',
        'react-hooks-js/incompatible-library': 'warn',
        'react-hooks-js/globals': 'warn',
        'react-hooks-js/error-boundaries': 'warn',
        'react-hooks-js/unsupported-syntax': 'warn',
      },
    },
    {
      // Alpha JS plugin, warnings only (OQ-T10): strings outside JSX in UI code need `t`.
      files: [
        'apps/web/src/{features,ui,routes}/**/*.{ts,tsx}',
        'apps/web/src/app/StartupError.tsx',
      ],
      rules: {
        'lingui/no-unlocalized-strings': [
          'warn',
          {
            // Identifiers, tokens and paths: no spaces and no capitals.
            ignore: ['^[a-z0-9@./:_#()\\[\\]=*,!%+-]+$'],
            ignoreNames: [
              'className',
              'to',
              'type',
              'variant',
              'size',
              'role',
              'name',
              'value',
              'accept',
              'inputMode',
              'autoCapitalize',
              'autoComplete',
              'rel',
              'data-testid',
              { regex: { pattern: 'Class$' } },
            ],
            ignoreFunctions: [
              'cn',
              'cva',
              'clsx',
              'createFileRoute',
              'isEnabled',
              'useMeta',
              'Error',
              'console.*',
              'matchMedia',
            ],
          },
        ],
        'lingui/t-call-in-function': 'warn',
        'lingui/no-single-variables-to-translate': 'warn',
      },
    },
    {
      files: ['apps/web/src/features/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: [...STORAGE_LIBS], message: 'Features read and write through hooks (§8.5).' },
          {
            group: ['**/infrastructure/**', '**/sw/**'],
            message: 'Features never touch infrastructure.',
          },
          { group: ['workbox-*'], message: 'Service-worker code stays in src/sw.' },
          LAZY_BACKUP,
        ),
      },
    },
    {
      files: ['apps/web/src/routes/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: [...STORAGE_LIBS, 'workbox-*'], message: 'Routes stay thin.' },
          { regex: ZOD_PACKAGE, message: 'Import z from src/zod (JIT-less for the CSP).' },
          {
            group: ['**/infrastructure/**', '**/sw/**'],
            message: 'Routes never touch infrastructure.',
          },
          LAZY_BACKUP,
        ),
      },
    },
    {
      files: ['apps/web/src/hooks/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: [...STORAGE_LIBS], message: 'Hooks call use cases, not Dexie.' },
          {
            group: ['**/infrastructure/**', '**/features/**'],
            message: 'Hooks use the container.',
          },
          LAZY_BACKUP,
        ),
      },
    },
    {
      files: ['apps/web/src/infrastructure/**'],
      rules: {
        'no-restricted-imports': restrict(
          {
            group: ['**/features/**', '**/ui/**', '**/hooks/**', '**/routes/**'],
            message: 'Adapters know nothing about the UI.',
          },
          { regex: UI_ALIAS, message: 'Adapters know nothing about the UI.' },
          LAZY_BACKUP,
        ),
      },
    },
    {
      files: ['apps/web/src/ui/**'],
      rules: {
        'no-restricted-imports': restrict(
          { group: ['@powr/*'], message: 'The design system is domain-free.' },
          {
            group: ['**/features/**', '**/hooks/**', '**/infrastructure/**', '**/routes/**'],
            message: 'The design system imports only ui.',
          },
          { group: [...STORAGE_LIBS], message: 'The design system is storage-free.' },
        ),
      },
    },
    {
      // The service worker never opens `powr` and ships no app code (§8.4).
      files: ['apps/web/src/sw/**'],
      rules: {
        'no-restricted-imports': restrict(
          {
            group: [...UI_FRAMEWORKS, ...STORAGE_LIBS, '@powr/*'],
            message: 'The service worker stays tiny.',
          },
          { regex: UI_ALIAS, message: 'The service worker stays tiny.' },
          {
            group: ['../**', '!../infrastructure/runtime-db', '!../infrastructure/runtime-db/**'],
            message: 'The service worker may only import src/infrastructure/runtime-db.',
          },
        ),
      },
    },
    {
      // Developer harness pages for device spikes S-1/S-2: English-only diagnostics, not product UI.
      files: ['apps/web/src/features/debug/**', '**/*.test.{ts,tsx}', 'apps/web/e2e/**'],
      rules: {
        'react/jsx-no-literals': 'off',
        'lingui/no-unlocalized-strings': 'off',
      },
    },
    {
      // The one place per package that may import Zod directly (it switches JIT off first).
      files: ['packages/*/src/zod.ts'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // Command-line tools report on stdout.
      files: ['tools/**', 'apps/web/scripts/**', 'deploy/**'],
      rules: { 'eslint/no-console': 'off' },
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/test/**', 'apps/web/e2e/**'],
      rules: {
        'typescript/no-non-null-assertion': 'off',
      },
    },
    {
      // Playwright fixtures call `use()` (not React's hook) and need `{}` for dependency-free fixtures.
      files: ['apps/web/e2e/**'],
      rules: { 'react/rules-of-hooks': 'off', 'eslint/no-empty-pattern': 'off' },
    },
  ],
};

export default defineConfig(config);
