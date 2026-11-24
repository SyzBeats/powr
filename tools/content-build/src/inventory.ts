import { parse, parseDocument, isSeq } from 'yaml';

/** One `assets` entry of assets-inventory.yaml (read by tools/licence, LEG-08). */
export interface AssetEntry {
  readonly name: string;
  readonly version: string;
  readonly licence: string;
  readonly distributed: boolean;
  readonly copyright: string;
  readonly approval: string;
}

/** The build owns every asset entry with this prefix; other entries are left alone. */
const PREFIX = 'powr-content-';

const OWN_WORK = {
  licence: 'LicenseRef-Own-Work',
  distributed: true,
  approval:
    'Pending product-owner review of this content set; LicenseRef-Own-Work itself is ' +
    'allowlisted (approved by the product owner, 2026-11-24)',
} as const;

/**
 * The content's entries in the licence and attribution inventory (LEG-06, LEG-08, §8.12 step 6).
 * Everything is original work written for POWR. Muscle credits cite studies as facts through the
 * source registry; no third-party text, data set or media is included, so no attribution entry
 * is needed. `version` is the content SemVer.
 */
export function contentAssets(version: string): AssetEntry[] {
  return [
    {
      name: `${PREFIX}exercises`,
      copyright:
        'Exercise library: names, execution cues, muscle mappings and defaults written for POWR ' +
        '(own work, SZ WEB DEVELOPMENT)',
    },
    {
      name: `${PREFIX}muscle-taxonomy`,
      copyright:
        'Muscle taxonomy, body-map region IDs and display names written for POWR (own work, ' +
        'SZ WEB DEVELOPMENT)',
    },
    {
      name: `${PREFIX}equipment`,
      copyright:
        'Equipment catalog and gym presets written for POWR (own work, SZ WEB DEVELOPMENT)',
    },
    {
      name: `${PREFIX}templates`,
      copyright: 'Program templates written for POWR (own work, SZ WEB DEVELOPMENT)',
    },
  ].map(({ name, copyright }) => ({
    name,
    version,
    licence: OWN_WORK.licence,
    distributed: OWN_WORK.distributed,
    copyright,
    approval: OWN_WORK.approval,
  }));
}

/** The content entries currently in an inventory file. */
export function contentAssetsIn(inventoryYaml: string): AssetEntry[] {
  const assets = (parse(inventoryYaml) as { assets?: AssetEntry[] } | null)?.assets ?? [];
  return assets.filter((asset) => asset.name.startsWith(PREFIX));
}

/**
 * Replaces the content entries of an inventory file and keeps everything else, comments
 * included. New entries go after the existing ones.
 */
export function withContentAssets(inventoryYaml: string, entries: readonly AssetEntry[]): string {
  const document = parseDocument(inventoryYaml);
  const assets = document.get('assets');
  if (!isSeq(assets)) throw new Error('assets-inventory.yaml has no assets list');
  assets.items = assets.items.filter((item) => {
    const name = (item as { get?: (key: string) => unknown }).get?.('name');
    return !(typeof name === 'string' && name.startsWith(PREFIX));
  });
  for (const entry of entries) assets.add(document.createNode(entry));
  return document.toString({ lineWidth: 0, singleQuote: true });
}
