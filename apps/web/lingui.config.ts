import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'pseudo'],
  pseudoLocale: 'pseudo',
  fallbackLocales: { default: 'en' },
  catalogs: [
    {
      path: '<rootDir>/src/i18n/locales/{locale}/messages',
      include: ['src'],
      exclude: ['**/*.test.*', 'src/features/debug/**'],
    },
  ],
  // No line numbers, so the catalog only changes when messages change (CI catalog check).
  format: formatter({ lineNumbers: false }),
});
