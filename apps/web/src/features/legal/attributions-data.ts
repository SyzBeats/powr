/**
 * The attributions data (LEG-06): `attributions.json`, written into the build by tools/licence
 * from the licence inventory and precached by the service worker, so the screen works offline.
 * Same origin; checked before use (an older build's file has no `kind`: those are packages).
 */
export interface AttributionEntry {
  readonly kind: 'npm' | 'asset';
  readonly name: string;
  readonly version: string;
  readonly licence: string;
  readonly copyright: readonly string[];
  readonly licenceText: string | null;
  readonly noticeText: string | null;
}

const isText = (value: unknown): value is string => typeof value === 'string';
const isOptionalText = (value: unknown): value is string | null =>
  value === null || value === undefined || isText(value);

function toEntry(value: unknown): AttributionEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { kind, name, version, licence, copyright, licenceText, noticeText } = record;
  if (!isText(name) || !isText(version) || !isText(licence)) return null;
  if (kind !== undefined && kind !== 'npm' && kind !== 'asset') return null;
  if (!Array.isArray(copyright) || !copyright.every(isText)) return null;
  if (!isOptionalText(licenceText) || !isOptionalText(noticeText)) return null;
  return {
    kind: kind ?? 'npm',
    name,
    version,
    licence,
    copyright,
    licenceText: licenceText ?? null,
    noticeText: noticeText ?? null,
  };
}

/** Reads and checks the build's attributions; throws when the file is missing or malformed. */
export async function fetchAttributions(): Promise<readonly AttributionEntry[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}attributions.json`);
  if (!response.ok) throw new Error(`attributions.json: HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('attributions.json: not a list');
  const entries = data.map(toEntry);
  if (entries.some((entry) => entry === null))
    throw new Error('attributions.json: malformed entry');
  return entries as AttributionEntry[];
}
