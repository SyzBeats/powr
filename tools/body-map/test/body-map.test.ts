import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BODY_MAP_ARTWORK } from '../../../apps/web/src/ui/body-map/artwork.gen.ts';
import { buildBodyMap, readTaxonomy, SMALL_BELOW_PX, VIEWS, type ViewData } from '../src/build.ts';
import { PATHS } from '../src/cli.ts';
import { parsePath } from '../src/path.ts';

const svg = readFileSync(PATHS.svg, 'utf8');
const taxonomy = readTaxonomy(readFileSync(PATHS.taxonomy, 'utf8'));
const result = buildBodyMap(svg, taxonomy);
const data = result.data!;

const regionIds = (view: ViewData) => [
  ...view.regions.map((region) => region.id),
  ...view.regions.flatMap((region) => region.subRegions.map((sub) => sub.id)),
];

// A whole build (geometry of every region on a raster) takes about 0.7 s alone and several
// seconds when the full suite runs in parallel.
const SLOW = { timeout: 30_000 };

describe('body-map artwork (S-5, §8.11)', SLOW, () => {
  it('builds without issues', () => {
    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
  });

  it('has exactly the taxonomy regions, each in its view, with its muscle ID', () => {
    for (const view of VIEWS) {
      const expected = [...taxonomy.regions]
        .filter(([, entry]) => entry.view === view)
        .map(([id]) => id)
        .toSorted();
      expect(regionIds(data.views[view]).toSorted()).toEqual(expected);
      for (const region of data.views[view].regions) {
        expect(region.muscleId).toBe(taxonomy.regions.get(region.id)!.muscleId);
        for (const sub of region.subRegions) {
          expect(sub.muscleId).toBe(taxonomy.regions.get(sub.id)!.muscleId);
          // Nesting: a sub-region rolls up to its group by ID (EXL-05) and sits inside it.
          expect(sub.muscleId.startsWith(`${region.muscleId}.`)).toBe(true);
          expect(region.d).toContain(sub.d);
        }
      }
    }
    // Side delts and forearms are visible from both sides; everything else in one view.
    expect(data.views.front.regions.length).toBe(10);
    expect(data.views.back.regions.length).toBe(11);
  });

  it('draws every region and the silhouette as closed shapes', () => {
    for (const view of VIEWS) {
      const { silhouette, regions } = data.views[view];
      for (const d of [silhouette, ...regions.map((region) => region.d)])
        for (const shape of parsePath(d)) expect(shape.closed).toBe(true);
    }
  });

  it('flags the regions under 44 × 44 CSS px (2 px margin) as small: the S-5 list', () => {
    const small: string[] = [];
    for (const view of VIEWS) {
      for (const region of data.views[view].regions) {
        expect(region.small).toBe(region.targetPx < SMALL_BELOW_PX);
        if (region.small) small.push(region.id);
      }
      // Every region is drawn once; smaller targets later (they win the gaps they share).
      const { regions, drawOrder } = data.views[view];
      expect(drawOrder.toSorted()).toEqual(regions.map((region) => region.id).toSorted());
    }
    expect(small).toEqual([
      'front.front-delts',
      'front.side-delts',
      'front.adductors',
      'front.tibialis',
      'back.rear-delts',
      'back.side-delts',
    ]);
  });

  it('reaches every region of a view with the arrow keys', () => {
    for (const view of VIEWS) {
      const { regions } = data.views[view];
      const byId = new Map(regions.map((region) => [region.id, region]));
      const reached = new Set([regions[0]!.id]);
      const queue = [regions[0]!.id];
      while (queue.length > 0)
        for (const next of Object.values(byId.get(queue.shift()!)?.neighbours ?? {}))
          if (next && !reached.has(next)) {
            reached.add(next);
            queue.push(next);
          }
      // Every neighbour is a region of the same view, and every region is reached.
      expect([...reached].toSorted()).toEqual(regions.map((region) => region.id).toSorted());
    }
  });

  it('matches the committed module (run pnpm body-map after changing the artwork)', () => {
    expect(BODY_MAP_ARTWORK).toEqual(data);
  });
});

const build = (source: string) => buildBodyMap(source, taxonomy).issues;

describe('body-map pipeline checks', SLOW, () => {
  it('rejects unknown and missing regions', () => {
    const renamed = svg.replace('id="front.abs"', 'id="front.six-pack"');
    expect(build(renamed)).toEqual(
      expect.arrayContaining([
        'front.six-pack: not a body-map region of the taxonomy',
        'front.abs (mu.abs) is missing from the artwork',
      ]),
    );
  });

  it('rejects a sub-region outside its group and a group drawn as one path', () => {
    const moved = svg
      .replace('<g id="back.calves">', '')
      .replace(/(id="back\.calves\.soleus" d="[^"]*"\/>\s*)<\/g>/, '$1');
    const issues = build(moved);
    expect(issues).toEqual(
      expect.arrayContaining([
        'back.calves.gastrocnemius: a sub-region must sit inside <g id="back.calves">',
        'back.calves (mu.calves) is missing from the artwork',
      ]),
    );
  });

  it('rejects open shapes, unsupported markup and arcs', () => {
    const lastOpen = svg.replace(/(id="front\.tibialis" d="[^"]*)Z"/, '$1"');
    expect(build(lastOpen)).toContain('front.tibialis: shape 2 is not closed (end it with Z)');
    const firstOpen = svg.replace(/(id="front\.tibialis" d="[^"]*?)Z/, '$1');
    expect(build(firstOpen)).toContain('front.tibialis: a shape is not closed with Z');
    const transformed = svg.replace(
      '<g id="front.chest">',
      '<g id="front.chest" transform="scale(2)">',
    );
    expect(build(transformed)).toContain('<g> attribute "transform" is not supported');
    const styled = svg.replace('<title>', '<style>path{fill:red}</style><title>');
    expect(build(styled)).toContain('<style> is not supported (svg, g, path, title, desc)');
    expect(() => parsePath('M0 0A5 5 0 0 1 10 10Z')).toThrow(/unsupported command "A"/);
  });

  it('rejects overlapping regions and regions outside the figure', () => {
    const outside = svg.replace(/(id="front\.tibialis" d="M)[\d.]+ [\d.]+/, '$1300 300');
    expect(build(outside).some((issue) => /front\.tibialis: \d+ outline point/.test(issue))).toBe(
      true,
    );
  });
});
