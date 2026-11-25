import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

/** Long texts read rarely stay out of the boot catalog (M5s): each is a lazy catalog of its own. */
const LAZY_CATALOGS = {
  // The legal texts, the imprint, "How POWR decides" and the attributions screen (LEG-01…09).
  legal: 'src/features/legal/texts',
  // The registry's parameter labels (`params.<id>`, TD-33) for the "Why?" sheet.
  params: 'src/features/why/params',
};

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'pseudo'],
  pseudoLocale: 'pseudo',
  fallbackLocales: { default: 'en' },
  catalogs: [
    {
      path: '<rootDir>/src/i18n/locales/{locale}/messages',
      include: ['src'],
      exclude: [
        '**/*.test.*',
        'src/features/debug/**',
        ...Object.values(LAZY_CATALOGS).map((dir) => `${dir}/**`),
      ],
    },
    ...Object.entries(LAZY_CATALOGS).map(([name, dir]) => ({
      path: `<rootDir>/src/i18n/locales/{locale}/${name}`,
      include: [dir],
      exclude: ['**/*.test.*'],
    })),
  ],
  // No line numbers, so the catalog only changes when messages change (CI catalog check).
  format: formatter({ lineNumbers: false }),
});
