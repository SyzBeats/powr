import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  parseReleaseNotes,
  readReleaseNotes,
  releaseNotesCheck,
  toChangelog,
} from '../src/index.ts';

/* NFR-MNT-07, SET-09, TD-20 (M6c): versioned release notes compiled into changelog.json. */

const notes = (version: string, date: string, body: string, reviewed = true) =>
  `---\nversion: ${version}\ndate: ${date}\nreviewed: ${reviewed}\n---\n\n${body}`;
const BODY =
  'A short summary\nthat goes on.\n\n## New\n- One thing,\n  told on two lines.\n- Another.\n';

function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'powr-notes-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('parseReleaseNotes', () => {
  it('reads the front matter, the summary and the sections as plain text', () => {
    expect(parseReleaseNotes('1.2.0.md', notes('1.2.0', '2027-01-15', BODY))).toEqual({
      version: '1.2.0',
      date: '2027-01-15',
      reviewed: true,
      summary: 'A short summary that goes on.',
      sections: [{ title: 'New', items: ['One thing, told on two lines.', 'Another.'] }],
    });
  });

  it.each([
    ['1.2.0.md', 'version: 1.2.0', 'no closing', '---\nversion: 1.2.0\n'],
    ['1.2.0.md', '', 'start with front matter', 'Summary\n'],
    ['1.2.md', '', 'is not X.Y.Z', notes('1.2', '2027-01-15', BODY)],
    ['1.2.1.md', '', 'must be 1.2.0.md', notes('1.2.0', '2027-01-15', BODY)],
    ['1.2.0.md', '', 'calendar date', notes('1.2.0', '2027-02-30', BODY)],
    [
      '1.2.0.md',
      '',
      'reviewed is true or false',
      notes('1.2.0', '2027-01-15', BODY, 'yes' as never),
    ],
    [
      '1.2.0.md',
      '',
      'unknown section "Highlights"',
      notes('1.2.0', '2027-01-15', 'S.\n\n## Highlights\n- x\n'),
    ],
    [
      '1.2.0.md',
      '',
      'in this order',
      notes('1.2.0', '2027-01-15', 'S.\n\n## Fixed\n- x\n\n## New\n- y\n'),
    ],
    [
      '1.2.0.md',
      '',
      'plain text only',
      notes('1.2.0', '2027-01-15', 'S.\n\n## New\n- See [the docs](https://x.example)\n'),
    ],
    [
      '1.2.0.md',
      '',
      'plain text only',
      notes('1.2.0', '2027-01-15', 'S.\n\n## New\n- <b>bold</b>\n'),
    ],
    [
      '1.2.0.md',
      '',
      'a summary paragraph comes first',
      notes('1.2.0', '2027-01-15', '## New\n- x\n'),
    ],
    ['1.2.0.md', '', 'at least one', notes('1.2.0', '2027-01-15', 'Only a summary.\n')],
    ['1.2.0.md', '', 'has no items', notes('1.2.0', '2027-01-15', 'S.\n\n## New\n')],
    [
      '1.2.0.md',
      '',
      'must be a "- " list item',
      notes('1.2.0', '2027-01-15', 'S.\n\nA second paragraph.\n\n## New\n- x\n'),
    ],
    [
      '1.2.0.md',
      '',
      'only "## " section headings',
      notes('1.2.0', '2027-01-15', 'S.\n\n### New\n- x\n'),
    ],
  ])('rejects %s (%s): %s', (file, _note, message, source) => {
    expect(() => parseReleaseNotes(file, source)).toThrow(message);
  });

  it('names the file and the line of a problem', () => {
    expect(() =>
      parseReleaseNotes('1.0.0.md', notes('1.0.0', '2027-01-15', 'S.\n\n## New\n- `code`\n')),
    ).toThrow('1.0.0.md:10: plain text only');
  });
});

describe('readReleaseNotes and the changelog', () => {
  it('sorts newest first by version and ships no review flag', () => {
    const dir = folder({
      '0.9.0.md': notes('0.9.0', '2026-10-01', BODY),
      '0.10.0.md': notes('0.10.0', '2026-11-01', BODY, false),
      'README.md': '# Not a release',
    });
    const read = readReleaseNotes(dir, { appVersion: '0.10.0', today: '2026-11-25' });
    expect(read.map((entry) => entry.version)).toEqual(['0.10.0', '0.9.0']);
    const changelog = toChangelog(read);
    expect(changelog).toMatchObject({ format: 'powr-changelog', formatVersion: 1 });
    expect(changelog.releases[0]).not.toHaveProperty('reviewed');
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
  });

  it('refuses a missing app version, a future date and dates that go back', () => {
    const dir = folder({ '1.0.0.md': notes('1.0.0', '2026-11-25', BODY) });
    expect(() => readReleaseNotes(dir, { appVersion: '1.1.0' })).toThrow(
      'No release notes for the app version 1.1.0',
    );
    // One day of grace for time zones, no more.
    expect(readReleaseNotes(dir, { today: '2026-11-24' })).toHaveLength(1);
    expect(() => readReleaseNotes(dir, { today: '2026-11-23' })).toThrow('after today');
    const back = folder({
      '1.0.0.md': notes('1.0.0', '2026-11-25', BODY),
      '1.1.0.md': notes('1.1.0', '2026-11-20', BODY),
    });
    expect(() => readReleaseNotes(back)).toThrow('1.1.0.md is dated 2026-11-20, before 1.0.0');
  });

  it('the production gate wants the notes of the app version, reviewed', () => {
    const dir = folder({
      '1.0.0.md': notes('1.0.0', '2026-11-25', BODY, false),
      '0.9.0.md': notes('0.9.0', '2026-11-01', BODY),
    });
    expect(releaseNotesCheck(dir, '0.9.0').ok).toBe(true);
    expect(releaseNotesCheck(dir, '1.0.0')).toMatchObject({
      ok: false,
      report: expect.stringContaining('1.0.0.md is not reviewed yet'),
    });
    expect(releaseNotesCheck(dir, '2.0.0')).toMatchObject({
      ok: false,
      report: expect.stringContaining('No release notes for the app version 2.0.0'),
    });
  });
});

describe('the real release notes (docs/release-notes)', () => {
  const dir = fileURLToPath(new URL('../../../docs/release-notes', import.meta.url));

  it('compile, include the app version and are dated no later than they were written', async () => {
    const { version } = (await import('../../../apps/web/package.json', { with: { type: 'json' } }))
      .default;
    const read = readReleaseNotes(dir, { appVersion: version, today: '2026-11-25' });
    expect(read.length).toBeGreaterThan(0);
    // The seed (M6c): the MVP as it stands, for the beta, not reviewed by the product owner yet.
    expect(read.at(-1)).toMatchObject({ version: '0.0.0', date: '2026-11-25' });
  });
});
