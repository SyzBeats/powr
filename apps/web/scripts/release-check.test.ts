import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/*
 * The release gate (M5s, product-owner decision 2026-11-25): `pnpm release:check` fails while a
 * legal placeholder remains and passes once every detail is filled in. The details module is app
 * code without imports; it is loaded the way the CLI loads it.
 */
interface Details {
  readonly postalAddress: readonly string[] | { readonly placeholder: string };
  readonly legalReview: string | { readonly placeholder: string };
  readonly [key: string]: unknown;
}
const legal = (await import(
  new URL('../src/features/legal/publisher.ts', import.meta.url).href
)) as {
  readonly LEGAL_DETAILS: Details;
  readonly legalPlaceholders: (details?: Details) => string[];
  readonly releaseCheck: (details?: Details) => { readonly ok: boolean; readonly report: string };
};

describe('release check (LEG-09)', () => {
  const filled: Details = {
    ...legal.LEGAL_DETAILS,
    postalAddress: ['Musterstrasse 1', '8000 Zürich'],
    legalReview: '2027-01-15',
  };

  it('names the publisher as decided and keeps the address a placeholder', () => {
    expect(legal.LEGAL_DETAILS).toMatchObject({
      person: 'Simeon Zimmermann',
      business: 'SZ WEB DEVELOPMENT',
      country: 'Switzerland',
      email: 'tools@sz-development.com',
      postalAddress: { placeholder: expect.stringContaining('postal address') },
    });
  });

  it('fails with the placeholders and passes when they are filled', () => {
    expect(legal.legalPlaceholders()).toHaveLength(2);
    const failing = legal.releaseCheck();
    expect(failing.ok).toBe(false);
    expect(failing.report).toContain('the postal address of the publisher (LEG-09)');
    expect(failing.report).toContain('legal review');

    expect(legal.legalPlaceholders(filled)).toEqual([]);
    expect(legal.releaseCheck(filled)).toEqual({
      ok: true,
      report: 'Release check passed: no legal placeholder remains.',
    });
    // One missing detail is enough to fail.
    expect(legal.releaseCheck({ ...filled, legalReview: { placeholder: 'review' } }).ok).toBe(
      false,
    );
  });

  it('the CLI exits non-zero while a placeholder remains', () => {
    const script = fileURLToPath(new URL('release-check.ts', import.meta.url));
    let status = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      const failure = error as { status: number; stderr: string };
      status = failure.status;
      stderr = failure.stderr;
    }
    expect(status).toBe(1);
    expect(stderr).toContain('Release check FAILED: 2 legal placeholder(s) remain');
    // M6c (NFR-MNT-07): the app version's release notes must be written and reviewed too; the
    // seed notes of the beta are not reviewed yet.
    expect(stderr).toContain('Release notes FAILED');
  });
});
