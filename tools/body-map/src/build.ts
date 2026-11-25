import { parse as parseYaml } from 'yaml';

import { centroid, gridFor, inside, largestSquare, neighbours, rasterize } from './geometry.ts';
import { flatten, formatPath, parsePath, type Point, type Subpath } from './path.ts';
import { parseSvg, type SvgNode } from './svg.ts';

/**
 * The body-map pipeline (S-5, technical concept §8.11): the original SVG artwork plus the muscle
 * taxonomy (packages/content/data/muscles.yaml, PRD §7.2) → the typed region data the app draws
 * (apps/web/src/ui/body-map/artwork.gen.ts). It fails on anything that does not match the
 * taxonomy exactly, and measures every region's tap target at the reference size (MAP-01).
 */
export const VIEWS = ['front', 'back'] as const;
export type View = (typeof VIEWS)[number];

/**
 * The default render size: the figure fills a 360 px screen's column, 320 CSS px wide (20rem at
 * 16 px, the BodyMap's maximum width) and about 725 px tall. Tap targets are measured at this
 * size (S-5); a figure fitted to the screen height (about 255 px wide) left 14 of 21 regions
 * under 44 px.
 */
const REFERENCE_WIDTH_PX = 320;
/** The invisible hit area: each region's outline with this stroke width (§8.11: 12–16 units). */
const HIT_STROKE = 12;
/** MAP-01: a region whose tap target is smaller than 44 × 44 CSS px also gets a chip. */
const MIN_TARGET_PX = 44;
/**
 * The raster here (half a unit, about 0.7 CSS px) and the browser's hit testing differ by up to
 * about 2 px, so a region counts as small below 46 px: a borderline region gets its chip.
 */
export const SMALL_BELOW_PX = MIN_TARGET_PX + 2;
const CELL = 0.5;

export interface SubRegionData {
  readonly id: string;
  readonly muscleId: string;
  readonly d: string;
}

export interface RegionData {
  readonly id: string;
  readonly muscleId: string;
  readonly d: string;
  readonly subRegions: readonly SubRegionData[];
  readonly targetPx: number;
  readonly small: boolean;
  readonly neighbours: {
    readonly up: string | null;
    readonly down: string | null;
    readonly left: string | null;
    readonly right: string | null;
  };
}

export interface ViewData {
  readonly view: View;
  readonly viewBox: string;
  readonly silhouette: string;
  readonly details: string;
  readonly regions: readonly RegionData[];
  readonly drawOrder: readonly string[];
}

export interface ArtworkData {
  readonly reference: {
    readonly widthPx: number;
    readonly hitStroke: number;
    readonly minTargetPx: number;
  };
  readonly views: { readonly front: ViewData; readonly back: ViewData };
}

/** Region ID → muscle ID per view, and each group's sub-regions (from the taxonomy). */
export interface Taxonomy {
  readonly regions: ReadonlyMap<
    string,
    { readonly muscleId: string; readonly view: View; readonly group: string | null }
  >;
}

interface YamlMuscle {
  readonly id: string;
  readonly bodyMap?: Partial<Record<View, string>>;
  readonly subRegions?: readonly YamlMuscle[];
}

export function readTaxonomy(yamlText: string): Taxonomy {
  const muscles = parseYaml(yamlText) as YamlMuscle[];
  const regions = new Map<string, { muscleId: string; view: View; group: string | null }>();
  for (const muscle of muscles) {
    for (const view of VIEWS) {
      const region = muscle.bodyMap?.[view];
      if (region) regions.set(region, { muscleId: muscle.id, view, group: null });
    }
    for (const sub of muscle.subRegions ?? [])
      for (const view of VIEWS) {
        const region = sub.bodyMap?.[view];
        const group = muscle.bodyMap?.[view] ?? null;
        if (region) regions.set(region, { muscleId: sub.id, view, group });
      }
  }
  return { regions };
}

interface Shape {
  readonly id: string;
  readonly subpaths: readonly Subpath[];
  readonly polygons: Point[][];
}

export interface BuildResult {
  readonly issues: readonly string[];
  readonly data: ArtworkData | null;
  readonly summary: readonly string[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function boxOf(polygons: readonly (readonly Point[])[]) {
  const xs = polygons.flat().map(([x]) => x);
  const ys = polygons.flat().map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function buildBodyMap(svgText: string, taxonomy: Taxonomy): BuildResult {
  const { root, issues } = parseSvg(svgText);
  if (!root) return { issues, data: null, summary: [] };
  const views = new Map<View, ViewData>();
  const summary: string[] = [];
  const seen = new Set<string>();

  const shapeOf = (node: SvgNode, id: string): Shape | null => {
    const d = node.attributes.get('d');
    if (!d) {
      issues.push(`${id}: no path data`);
      return null;
    }
    try {
      const subpaths = parsePath(d);
      for (const [index, subpath] of subpaths.entries())
        if (!subpath.closed) issues.push(`${id}: shape ${index + 1} is not closed (end it with Z)`);
      return { id, subpaths, polygons: flatten(subpaths) };
    } catch (error) {
      issues.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  for (const child of root.children) {
    if (child.name === 'title' || child.name === 'desc') continue;
    const view = child.attributes.get('id');
    if (child.name !== 'g' || !VIEWS.includes(view as View)) {
      issues.push(
        `top level: only <g id="front"> and <g id="back"> (found <${child.name}${view ? ` id="${view}"` : ''}>)`,
      );
      continue;
    }
    const viewName = view as View;
    if (views.has(viewName)) issues.push(`view ${viewName} appears twice`);
    const viewBox = child.attributes.get('data-view-box') ?? '';
    const box = viewBox.split(/\s+/).map(Number);
    if (
      box.length !== 4 ||
      box.some((value) => !Number.isFinite(value)) ||
      box[2]! <= 0 ||
      box[3]! <= 0
    )
      issues.push(`view ${viewName}: data-view-box must be "x y width height"`);
    if (child.text.trim() !== '') issues.push(`view ${viewName}: text content is not supported`);

    let silhouette: Shape | null = null;
    const details: Subpath[] = [];
    const groups: { id: string; muscleId: string; shapes: Shape[]; subRegions: SubRegionData[] }[] =
      [];
    for (const node of child.children) {
      if (node.name === 'path' && node.attributes.get('data-role') === 'silhouette') {
        if (silhouette) issues.push(`view ${viewName}: more than one silhouette`);
        silhouette = shapeOf(node, `${viewName} silhouette`);
        continue;
      }
      if (node.name === 'path' && node.attributes.get('data-role') === 'detail') {
        // Decorative lines over the regions (the abs' segments): open paths are fine.
        try {
          details.push(...parsePath(node.attributes.get('d') ?? '', { open: true }));
        } catch (error) {
          issues.push(
            `${viewName} detail: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        continue;
      }
      const id = node.attributes.get('id') ?? '';
      if (node.attributes.has('data-role')) issues.push(`${id || viewName}: unknown data-role`);
      const entry = taxonomy.regions.get(id);
      if (seen.has(id)) issues.push(`${id}: appears twice`);
      seen.add(id);
      if (!entry) {
        issues.push(`${id || `<${node.name}> without id`}: not a body-map region of the taxonomy`);
        continue;
      }
      if (entry.view !== viewName) issues.push(`${id}: belongs to the ${entry.view} view`);
      if (entry.group !== null) {
        issues.push(`${id}: a sub-region must sit inside <g id="${entry.group}">`);
        continue;
      }
      const expected = [...taxonomy.regions]
        .filter(([, value]) => value.group === id)
        .map(([subId]) => subId);
      if (expected.length === 0) {
        if (node.name !== 'path') {
          issues.push(`${id}: has no sub-regions, so it must be one <path>`);
          continue;
        }
        const shape = shapeOf(node, id);
        if (shape) groups.push({ id, muscleId: entry.muscleId, shapes: [shape], subRegions: [] });
        continue;
      }
      if (node.name !== 'g') {
        issues.push(
          `${id}: has sub-regions (${expected.join(', ')}), so it must be a <g> of their paths`,
        );
        continue;
      }
      const shapes: Shape[] = [];
      const subRegions: SubRegionData[] = [];
      for (const subNode of node.children) {
        const subId = subNode.attributes.get('id') ?? '';
        const subEntry = taxonomy.regions.get(subId);
        if (seen.has(subId)) issues.push(`${subId}: appears twice`);
        seen.add(subId);
        if (subNode.name !== 'path' || !subEntry || subEntry.group !== id) {
          issues.push(
            `${subId || `<${subNode.name}>`} inside ${id}: not one of its sub-regions (${expected.join(', ')})`,
          );
          continue;
        }
        const shape = shapeOf(subNode, subId);
        if (!shape) continue;
        shapes.push(shape);
        subRegions.push({ id: subId, muscleId: subEntry.muscleId, d: formatPath(shape.subpaths) });
      }
      for (const subId of expected)
        if (!subRegions.some((sub) => sub.id === subId))
          issues.push(`${id}: sub-region ${subId} is missing`);
      groups.push({ id, muscleId: entry.muscleId, shapes, subRegions });
    }
    if (!silhouette) {
      issues.push(`view ${viewName}: no <path data-role="silhouette">`);
      continue;
    }

    // Geometry: inside the figure, no overlaps, tap targets, keyboard neighbours.
    const silhouettePolygons = silhouette.polygons;
    const centreX = box[0]! + box[2]! / 2;
    const scale = REFERENCE_WIDTH_PX / box[2]!;
    const grid = gridFor(box as [number, number, number, number], CELL, HIT_STROKE);
    const owners = new Int16Array(grid.columns * grid.rows).fill(-1);
    const shapeIds: string[] = [];
    const anyShape = new Uint8Array(grid.columns * grid.rows);
    const rasters = new Map<string, { shape: Uint8Array; band: Uint8Array; centreY: number }>();
    for (const group of groups) {
      const polygons = group.shapes.flatMap((shape) => shape.polygons);
      const groupCells = new Uint8Array(anyShape.length);
      for (const shape of group.shapes) {
        const outside = shape.polygons.flat().filter(([x, y]) => !inside(silhouettePolygons, x, y));
        if (outside.length > 0)
          issues.push(
            `${shape.id}: ${outside.length} outline point(s) outside the silhouette, e.g. ${outside[0]!.map(round1).join(',')}`,
          );
        const index = shapeIds.push(shape.id) - 1;
        const cells = rasterize(grid, shape.polygons);
        const clashes = new Set<number>();
        for (let cell = 0; cell < cells.length; cell++) {
          if (!cells[cell]) continue;
          groupCells[cell] = 1;
          anyShape[cell] = 1;
          const owner = owners[cell]!;
          if (owner >= 0 && owner !== index && !clashes.has(owner)) {
            clashes.add(owner);
            const x = grid.x0 + ((cell % grid.columns) + 0.5) * grid.cell;
            const y = grid.y0 + (Math.floor(cell / grid.columns) + 0.5) * grid.cell;
            issues.push(`${shape.id} overlaps ${shapeIds[owner]} near ${round1(x)},${round1(y)}`);
          }
          owners[cell] = index;
        }
      }
      const bounds = boxOf(polygons);
      rasters.set(group.id, {
        shape: groupCells,
        band: rasterize(grid, polygons, HIT_STROKE / 2),
        centreY: (bounds.minY + bounds.maxY) / 2,
      });
    }
    // The hit stroke only counts in the gaps between regions (the app clips it there), so a
    // visible region always takes its own taps; in a gap the region drawn last wins.
    for (const raster of rasters.values())
      for (let cell = 0; cell < raster.band.length; cell++)
        if (anyShape[cell]) raster.band[cell] = 0;

    // Reading order: top to bottom by the middle of each region.
    groups.sort((a, b) => rasters.get(a.id)!.centreY - rasters.get(b.id)!.centreY);
    // Drawing order of the app: by each region's own target (its shape and its whole hit area),
    // largest first, so a smaller region is drawn later and wins the gaps it shares with a larger
    // one. Then the target each region really gets in that order.
    const own = new Map(
      groups.map((group) => {
        const { shape, band } = rasters.get(group.id)!;
        const all = new Uint8Array(shape);
        for (let cell = 0; cell < band.length; cell++) if (band[cell]) all[cell] = 1;
        return [group.id, largestSquare(grid, all)];
      }),
    );
    const order = groups.map((group) => group.id).toSorted((a, b) => own.get(b)! - own.get(a)!);
    const targets = new Map<string, number>();
    const claimed = new Uint8Array(anyShape.length);
    for (const id of order.toReversed()) {
      const { shape, band } = rasters.get(id)!;
      const effective = new Uint8Array(shape);
      for (let cell = 0; cell < band.length; cell++)
        if (band[cell]) {
          if (!claimed[cell]) effective[cell] = 1;
          claimed[cell] = 1;
        }
      targets.set(id, round1(largestSquare(grid, effective) * scale));
    }
    const links = neighbours(
      new Map(
        groups.map((group) => [
          group.id,
          centroid(grid, rasters.get(group.id)!.shape, centreX + CELL),
        ]),
      ),
    );
    const regions: RegionData[] = groups.map((group) => ({
      id: group.id,
      muscleId: group.muscleId,
      d: formatPath(group.shapes.flatMap((shape) => shape.subpaths)),
      subRegions: group.subRegions,
      targetPx: targets.get(group.id)!,
      small: targets.get(group.id)! < SMALL_BELOW_PX,
      neighbours: links.get(group.id)!,
    }));
    views.set(viewName, {
      view: viewName,
      viewBox,
      silhouette: formatPath(silhouette.subpaths),
      details: formatPath(details),
      regions,
      drawOrder: order,
    });
    const smallRegions = regions.filter((region) => region.small);
    summary.push(
      `${viewName}: ${regions.length} regions; small (under ${SMALL_BELOW_PX} px at ${REFERENCE_WIDTH_PX} px wide): ` +
        (smallRegions.length === 0
          ? 'none'
          : smallRegions.map((region) => `${region.id} ${region.targetPx}`).join(', ')) +
        `; the others: ${regions
          .filter((region) => !region.small)
          .map((region) => `${region.id} ${region.targetPx}`)
          .join(', ')}`,
    );
  }

  for (const [id, entry] of taxonomy.regions)
    if (!seen.has(id)) issues.push(`${id} (${entry.muscleId}) is missing from the artwork`);
  for (const view of VIEWS) if (!views.has(view)) issues.push(`view ${view} is missing`);
  if (issues.length > 0) return { issues, data: null, summary };
  return {
    issues,
    data: {
      reference: { widthPx: REFERENCE_WIDTH_PX, hitStroke: HIT_STROKE, minTargetPx: MIN_TARGET_PX },
      views: { front: views.get('front')!, back: views.get('back')! },
    },
    summary,
  };
}

/** The generated module: the data plus its types (the app's design system may not import tools). */
export function emitModule(data: ArtworkData): string {
  return `/*
 * Generated by tools/body-map from tools/body-map/art/body-map.svg and the muscle taxonomy.
 * Do not edit: change the artwork, then run pnpm body-map.
 */
/* oxlint-disable lingui/no-unlocalized-strings -- path data and region IDs, not text */

export type BodyView = 'front' | 'back';

export interface ArtworkRegion {
  /** Body-map region ID of the taxonomy, e.g. front.chest. */
  readonly id: string;
  /** The display group, e.g. mu.chest. */
  readonly muscleId: string;
  /** Every shape of the region (its sub-regions together), absolute path data. */
  readonly d: string;
  /** MAP-07 drill-down: the sub-regions of PRD §7.2, nested in this region. */
  readonly subRegions: readonly { readonly id: string; readonly muscleId: string; readonly d: string }[];
  /** Largest square tap target at the reference width (CSS px): the region plus its hit area in the gaps. */
  readonly targetPx: number;
  /** Under the minimum target: the map also offers it as a chip below the figure (MAP-01). */
  readonly small: boolean;
  /** Arrow-key focus moves (region IDs of this view), null at the edge. */
  readonly neighbours: {
    readonly up: string | null;
    readonly down: string | null;
    readonly left: string | null;
    readonly right: string | null;
  };
}

export interface ArtworkView {
  readonly view: BodyView;
  readonly viewBox: string;
  readonly silhouette: string;
  /** Decorative lines drawn over the regions (no taps), e.g. the abs' segments. */
  readonly details: string;
  /** Top to bottom. */
  readonly regions: readonly ArtworkRegion[];
  /** Region IDs in drawing order: small regions last, so their hit areas win in the gaps. */
  readonly drawOrder: readonly string[];
}

export const BODY_MAP_ARTWORK: {
  readonly reference: {
    readonly widthPx: number;
    readonly hitStroke: number;
    readonly minTargetPx: number;
  };
  readonly views: { readonly front: ArtworkView; readonly back: ArtworkView };
} = ${JSON.stringify(data, null, 2)};
`;
}
