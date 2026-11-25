/**
 * `pnpm release:check` (M5s, product-owner decision 2026-11-25): fails while a legal placeholder
 * remains (the publisher's postal address, the legal review), so a production deploy cannot ship
 * draft legal texts. Run by `.github/workflows/deploy.yml` before the production promotion; not
 * part of `pnpm verify` or CI, which stay green while the texts are drafts.
 *
 * The details live in one app module without imports, loaded here with plain Node.
 */
const source = new URL('../src/features/legal/publisher.ts', import.meta.url);
const { releaseCheck } = (await import(source.href)) as {
  readonly releaseCheck: () => { readonly ok: boolean; readonly report: string };
};

const { ok, report } = releaseCheck();
if (ok) console.log(report);
else console.error(report);
process.exit(ok ? 0 : 1);
