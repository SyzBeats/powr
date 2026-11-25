/**
 * The release notes (NFR-MNT-07, SET-09, TD-20): `changelog.json`, compiled at build time by
 * tools/release-notes from the reviewed `docs/release-notes/<version>.md`. The service worker
 * fetches it network-first and falls back to the precached copy, so "What's new" also lists the
 * notes of a waiting update when online and the installed version's notes offline. Same origin;
 * checked before use. The texts are English data, shown as plain text.
 */
export interface ChangelogRelease {
  readonly version: string;
  readonly date: string;
  readonly summary: string;
  readonly sections: readonly { readonly title: string; readonly items: readonly string[] }[];
}

const isText = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toRelease(value: unknown): ChangelogRelease | null {
  if (!isRecord(value)) return null;
  const { version, date, summary, sections } = value;
  if (!isText(version) || !isText(date) || !isText(summary) || !Array.isArray(sections))
    return null;
  const parsed = sections.map((section: unknown) =>
    isRecord(section) &&
    isText(section['title']) &&
    Array.isArray(section['items']) &&
    section['items'].every(isText)
      ? { title: section['title'], items: section['items'] }
      : null,
  );
  if (parsed.some((section) => section === null)) return null;
  return { version, date, summary, sections: parsed as ChangelogRelease['sections'] };
}

/** Reads and checks the changelog; throws when it is missing or malformed. */
export async function fetchChangelog(): Promise<readonly ChangelogRelease[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}changelog.json`);
  if (!response.ok) throw new Error(`changelog.json: HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!isRecord(data) || data['format'] !== 'powr-changelog' || !Array.isArray(data['releases']))
    throw new Error('changelog.json: not a changelog');
  const releases = data['releases'].map(toRelease);
  if (releases.some((release) => release === null))
    throw new Error('changelog.json: malformed release');
  return releases as ChangelogRelease[];
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
