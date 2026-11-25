/**
 * `pnpm release:check` (M5s, product-owner decision 2026-11-25): fails while a legal placeholder
 * remains (the publisher's postal address, the legal review), so a production deploy cannot ship
 * draft legal texts. Since M6c it also fails while the app version has no release notes, or notes
 * not yet reviewed by the product owner (`reviewed: true` in `docs/release-notes/<version>.md`;
 * NFR-MNT-07). Run by `.github/workflows/deploy.yml` before the production promotion; not part of
 * `pnpm verify` or CI, which stay green while the texts are drafts.
 *
 * Everything it loads is plain Node without dependencies (the deploy job has no install). The
 * legal screens and the static website copy of the legal texts (dist/legal-static, TD-71) are
 * rendered from publisher.ts, so this gate covers both: while it fails, both show the "Draft"
 * marker and the postal-address placeholder (test/legal-static.test.tsx compares them word for
 * word).
 */
import { fileURLToPath } from 'node:url';

const source = new URL('../src/features/legal/publisher.ts', import.meta.url);
const { releaseCheck } = (await import(source.href)) as {
  readonly releaseCheck: () => { readonly ok: boolean; readonly report: string };
};
const notes = new URL('../../../tools/release-notes/src/index.ts', import.meta.url);
const { releaseNotesCheck } = (await import(notes.href)) as {
  readonly releaseNotesCheck: (
    dir: string,
    appVersion: string,
  ) => { readonly ok: boolean; readonly report: string };
};
const { version } = (
  (await import(new URL('../package.json', import.meta.url).href, {
    with: { type: 'json' },
  })) as { default: { version: string } }
).default;

const checks = [
  releaseCheck(),
  releaseNotesCheck(
    fileURLToPath(new URL('../../../docs/release-notes', import.meta.url)),
    version,
  ),
];
for (const { ok, report } of checks) {
  if (ok) console.log(report);
  else console.error(report);
}
process.exit(checks.every((check) => check.ok) ? 0 : 1);
