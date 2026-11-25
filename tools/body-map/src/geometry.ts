import type { Point } from './path.ts';

/** Even-odd test against one polygon. */
function insidePolygon(polygon: readonly Point[], x: number, y: number): boolean {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

/** Inside any of the shapes (each shape is a separate closed outline). */
export function inside(polygons: readonly (readonly Point[])[], x: number, y: number): boolean {
  return polygons.some((polygon) => insidePolygon(polygon, x, y));
}

function distanceToSegment(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** A raster over one view (cell centres), shared by every region of the view. */
export interface Grid {
  readonly x0: number;
  readonly y0: number;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
}

export function gridFor(
  box: readonly [number, number, number, number],
  cell: number,
  margin: number,
): Grid {
  const x0 = box[0] - margin;
  const y0 = box[1] - margin;
  return {
    x0,
    y0,
    cell,
    columns: Math.ceil((box[2] + 2 * margin) / cell),
    rows: Math.ceil((box[3] + 2 * margin) / cell),
  };
}

/** The shapes on the grid (scanline fill, even-odd), grown by `grow` units if given. */
export function rasterize(
  grid: Grid,
  polygons: readonly (readonly Point[])[],
  grow = 0,
): Uint8Array {
  const { x0, y0, cell, columns, rows } = grid;
  const cells = new Uint8Array(columns * rows);
  for (const polygon of polygons) {
    for (let row = 0; row < rows; row++) {
      const y = y0 + (row + 0.5) * cell;
      const crossings: number[] = [];
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]!;
        const [xj, yj] = polygon[j]!;
        if (yi > y !== yj > y) crossings.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const from = Math.max(0, Math.ceil((crossings[k]! - x0) / cell - 0.5));
        const to = Math.min(columns - 1, Math.floor((crossings[k + 1]! - x0) / cell - 0.5));
        for (let column = from; column <= to; column++) cells[row * columns + column] = 1;
      }
    }
    if (grow <= 0) continue;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j]!;
      const b = polygon[i]!;
      const firstRow = Math.max(0, Math.floor((Math.min(a[1], b[1]) - grow - y0) / cell));
      const lastRow = Math.min(rows - 1, Math.ceil((Math.max(a[1], b[1]) + grow - y0) / cell));
      const firstColumn = Math.max(0, Math.floor((Math.min(a[0], b[0]) - grow - x0) / cell));
      const lastColumn = Math.min(
        columns - 1,
        Math.ceil((Math.max(a[0], b[0]) + grow - x0) / cell),
      );
      for (let row = firstRow; row <= lastRow; row++) {
        const y = y0 + (row + 0.5) * cell;
        for (let column = firstColumn; column <= lastColumn; column++) {
          const index = row * columns + column;
          if (!cells[index] && distanceToSegment(x0 + (column + 0.5) * cell, y, a, b) <= grow)
            cells[index] = 1;
        }
      }
    }
  }
  return cells;
}

/** Side of the largest axis-aligned square of set cells, in units. */
export function largestSquare(grid: Grid, cells: Uint8Array): number {
  const { columns, rows } = grid;
  let previous = new Uint16Array(columns);
  let best = 0;
  for (let row = 0; row < rows; row++) {
    const current = new Uint16Array(columns);
    for (let column = 0; column < columns; column++) {
      if (!cells[row * columns + column]) continue;
      current[column] =
        column === 0 || row === 0
          ? 1
          : Math.min(previous[column]!, current[column - 1]!, previous[column - 1]!) + 1;
      best = Math.max(best, current[column]!);
    }
    previous = current;
  }
  return best * grid.cell;
}

/** Centre of the set cells (left of `maxX` only, when given). */
export function centroid(grid: Grid, cells: Uint8Array, maxX = Infinity): Point {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let row = 0; row < grid.rows; row++)
    for (let column = 0; column < grid.columns; column++) {
      if (!cells[row * grid.columns + column]) continue;
      const x = grid.x0 + (column + 0.5) * grid.cell;
      if (x > maxX) continue;
      sx += x;
      sy += grid.y0 + (row + 0.5) * grid.cell;
      n++;
    }
  return n === 0 ? [Number.NaN, Number.NaN] : [sx / n, sy / n];
}

export type Direction = 'up' | 'down' | 'left' | 'right';
const VECTORS: Record<Direction, Point> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Keyboard neighbours (§8.11): from each anchor, the closest other anchor within about 56° of
 * the arrow's direction, distance along the arrow plus twice the sideways offset.
 */
export function neighbours<Id extends string>(
  anchors: ReadonlyMap<Id, Point>,
): Map<Id, Record<Direction, Id | null>> {
  const result = new Map<Id, Record<Direction, Id | null>>();
  for (const [id, from] of anchors) {
    const entry = { up: null, down: null, left: null, right: null } as Record<Direction, Id | null>;
    for (const direction of Object.keys(VECTORS) as Direction[]) {
      const [dx, dy] = VECTORS[direction];
      let best: { id: Id; score: number } | null = null;
      for (const [other, to] of anchors) {
        if (other === id) continue;
        const vx = to[0] - from[0];
        const vy = to[1] - from[1];
        const along = vx * dx + vy * dy;
        const across = Math.abs(vx * dy - vy * dx);
        if (along <= 1 || across > along * 1.5) continue;
        const score = along + 2 * across;
        if (!best || score < best.score) best = { id: other, score };
      }
      entry[direction] = best?.id ?? null;
    }
    result.set(id, entry);
  }
  return result;
}
