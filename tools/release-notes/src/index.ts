import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Versioned release notes (NFR-MNT-07, SET-09, TD-20; technical concept §8.4, §8.21). One
 * reviewed Markdown file per app version, `docs/release-notes/<X.Y.Z>.md`, is the source; the
 * app build compiles all of them into `changelog.json`, which Settings → About → "What's new" and
 * the update notice read.
 *
 * The source format is deliberately small, so the app can render it as plain text (no HTML, no
 * Markdown renderer, nothing for Trusted Types to worry about):
 *
 * ```md
 * ---
 * version: 1.2.0
 * date: 2027-01-15
 * reviewed: true
 * ---
 *
 * One paragraph that sums the release up.
 *
 * ## New
 * - One change per item, in plain words. A long item may continue on lines indented by two
 *   spaces.
 * ```
 *
 * Section titles come from `SECTION_TITLES`, in that order. `reviewed: true` records that the
 * product owner has read the notes; the production deploy refuses a version whose notes are
 * missing or not reviewed (`pnpm release:check`). Dependency-free and erasable TypeScript only,
 * so plain Node runs it (the deploy job has no `pnpm install`).
 */

export const SECTION_TITLES = [
  'New',
  'Improved',
  'Changed',
  'Fixed',
  'Removed',
  'Known limitations',
] as const;
export type SectionTitle = (typeof SECTION_TITLES)[number];

export interface ReleaseSection {
  readonly title: SectionTitle;
  readonly items: readonly string[];
}

export interface Release {
  readonly version: string;
  /** The release date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly summary: string;
  readonly sections: readonly ReleaseSection[];
}

/** A parsed source file: the shipped fields plus the review flag, which is not shipped. */
export interface ReleaseNotes extends Release {
  readonly reviewed: boolean;
}

/** The shape of `changelog.json`: every release, newest first. */
export interface Changelog {
  readonly format: 'powr-changelog';
  readonly formatVersion: 1;
  readonly releases: readonly Release[];
}

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Markup the app would show literally, so the source must not use it. */
const MARKUP = /[<>`]|\[|\]|\*\*|__|https?:\/\//;

/** A problem in a release-notes file, with the file and line it is on. */
export class ReleaseNotesError extends Error {
  override readonly name = 'ReleaseNotesError';
}

/** Compares two `X.Y.Z` versions: negative when `a` is older. */
export function compareVersions(a: string, b: string): number {
  const [pa, pb] = [a, b].map((value) => value.split('.').map(Number));
  for (let index = 0; index < 3; index += 1) {
    const difference = (pa![index] ?? 0) - (pb![index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Parses one source file; `file` is its name, used for the messages and the version check. */
export function parseReleaseNotes(file: string, source: string): ReleaseNotes {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const fail = (line: number, message: string): never => {
    throw new ReleaseNotesError(`${file}:${line}: ${message}`);
  };

  if (lines[0] !== '---') fail(1, 'must start with front matter ("---")');
  const end = lines.indexOf('---', 1);
  if (end < 0) fail(1, 'the front matter has no closing "---"');
  const fields = new Map<string, string>();
  for (let index = 1; index < end; index += 1) {
    const match = /^([a-z]+):\s*(.*?)\s*$/.exec(lines[index]!);
    if (!match) fail(index + 1, 'front matter lines are "key: value"');
    const [, key, value] = match!;
    if (!['version', 'date', 'reviewed'].includes(key!)) fail(index + 1, `unknown field "${key}"`);
    if (fields.has(key!)) fail(index + 1, `"${key}" is given twice`);
    fields.set(key!, value!);
  }
  const version = fields.get('version') ?? fail(1, 'no "version"');
  const date = fields.get('date') ?? fail(1, 'no "date"');
  const reviewed = fields.get('reviewed') ?? fail(1, 'no "reviewed" (true or false)');
  if (!VERSION.test(version)) fail(1, `version "${version}" is not X.Y.Z`);
  if (file !== `${version}.md`) fail(1, `the file of version ${version} must be ${version}.md`);
  if (!isCalendarDate(date)) fail(1, `date "${date}" is not a YYYY-MM-DD calendar date`);
  if (reviewed !== 'true' && reviewed !== 'false') fail(1, 'reviewed is true or false');

  const summary: string[] = [];
  const sections: { title: SectionTitle; items: string[] }[] = [];
  let summaryDone = false;
  for (let index = end + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    const at = index + 1;
    if (line.trim() === '') {
      if (summary.length > 0) summaryDone = true;
      continue;
    }
    if (MARKUP.test(line))
      fail(at, 'plain text only: no HTML, links, code or emphasis (the app shows it as it is)');
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      if (!(SECTION_TITLES as readonly string[]).includes(title))
        fail(at, `unknown section "${title}"; use one of: ${SECTION_TITLES.join(', ')}`);
      const order = SECTION_TITLES.indexOf(title as SectionTitle);
      const previous = sections.at(-1);
      if (previous && SECTION_TITLES.indexOf(previous.title) >= order)
        fail(at, `sections go in this order, once each: ${SECTION_TITLES.join(', ')}`);
      sections.push({ title: title as SectionTitle, items: [] });
      summaryDone = true;
      continue;
    }
    const section = sections.at(-1);
    if (line.startsWith('- ')) {
      if (!section) fail(at, 'a list item needs a "## " section above it');
      section!.items.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith('  ') && section && section.items.length > 0) {
      section.items[section.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (line.startsWith('#')) fail(at, 'only "## " section headings are used');
    if (section || summaryDone)
      fail(at, 'text after the summary must be a "- " list item in a section');
    summary.push(line.trim());
  }
  if (summary.length === 0) fail(end + 2, 'a summary paragraph comes first');
  if (sections.length === 0) fail(end + 2, 'at least one "## " section with items');
  for (const section of sections)
    if (section.items.length === 0) fail(end + 2, `section "${section.title}" has no items`);

  return { version, date, reviewed: reviewed === 'true', summary: summary.join(' '), sections };
}

/**
 * Reads and checks every `<X.Y.Z>.md` in `dir` (a `README.md` there is the format description and
 * is skipped). Newest first. Fails on a bad file, on a release dated after `today` (one day's
 * grace for time zones), on dates that go back as versions go up, and when `appVersion` is given
 * but has no notes.
 */
export function readReleaseNotes(
  dir: string,
  options: { readonly appVersion?: string; readonly today?: string } = {},
): ReleaseNotes[] {
  const files = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md')
    : [];
  const notes = files
    .map((file) => parseReleaseNotes(file, readFileSync(join(dir, file), 'utf8')))
    .toSorted((a, b) => compareVersions(b.version, a.version));

  if (options.today) {
    const grace = new Date(`${options.today}T00:00:00Z`);
    grace.setUTCDate(grace.getUTCDate() + 1);
    const latest = grace.toISOString().slice(0, 10);
    for (const entry of notes)
      if (entry.date > latest)
        throw new ReleaseNotesError(
          `${entry.version}.md: dated ${entry.date}, after today (${options.today})`,
        );
  }
  for (let index = 1; index < notes.length; index += 1) {
    const newer = notes[index - 1]!;
    const older = notes[index]!;
    if (newer.date < older.date)
      throw new ReleaseNotesError(
        `${newer.version}.md is dated ${newer.date}, before ${older.version} (${older.date})`,
      );
  }
  if (options.appVersion && !notes.some((entry) => entry.version === options.appVersion))
    throw new ReleaseNotesError(
      `No release notes for the app version ${options.appVersion}: write ${options.appVersion}.md in ${dir}`,
    );
  return notes;
}

/** The shipped `changelog.json` (the review flag stays in the source). */
export function toChangelog(notes: readonly ReleaseNotes[]): Changelog {
  return {
    format: 'powr-changelog',
    formatVersion: 1,
    releases: notes.map(({ version, date, summary, sections }) => ({
      version,
      date,
      summary,
      sections,
    })),
  };
}

/**
 * The production gate (`pnpm release:check`): the app version has notes and they are reviewed.
 */
export function releaseNotesCheck(
  dir: string,
  appVersion: string,
): { readonly ok: boolean; readonly report: string } {
  let notes: ReleaseNotes[];
  try {
    notes = readReleaseNotes(dir, { appVersion });
  } catch (error) {
    return { ok: false, report: `Release notes FAILED: ${(error as Error).message}` };
  }
  const own = notes.find((entry) => entry.version === appVersion)!;
  if (!own.reviewed)
    return {
      ok: false,
      report: `Release notes FAILED: ${appVersion}.md is not reviewed yet (set "reviewed: true" once the product owner has read it).`,
    };
  return { ok: true, report: `Release notes for ${appVersion} are written and reviewed.` };
}
