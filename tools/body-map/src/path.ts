/**
 * SVG path data for the body map: parsed, checked for closed shapes, written back in one absolute
 * form (M, L, C, Q, Z with one decimal) and flattened to polygons for the geometry checks.
 * Arcs (A) are not supported: draw curves as Béziers (Inkscape and Figma export them that way).
 */
export type Point = readonly [number, number];

export type Segment =
  | { readonly kind: 'L'; readonly to: Point }
  | { readonly kind: 'C'; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly kind: 'Q'; readonly c: Point; readonly to: Point };

export interface Subpath {
  readonly start: Point;
  readonly segments: readonly Segment[];
  readonly closed: boolean;
}

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

/** Parses path data; throws with a readable message on anything it does not support. */
export function parsePath(d: string, options: { readonly open?: boolean } = {}): Subpath[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const rest = d.replaceAll(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[\s,]/g, '');
  if (rest !== '') throw new Error(`unexpected characters "${rest.slice(0, 10)}"`);
  const subpaths: { start: Point; segments: Segment[]; closed: boolean }[] = [];
  let current: { start: Point; segments: Segment[]; closed: boolean } | null = null;
  let point: Point = [0, 0];
  // The last curve's control point (for S and T); widened so the loop does not narrow it away.
  let lastControl = null as { kind: 'C' | 'Q'; point: Point } | null;
  let i = 0;
  let command = '';
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      i++;
      if (!(command.toUpperCase() in ARITY))
        throw new Error(`unsupported command "${command}" (use M, L, H, V, C, S, Q, T, Z)`);
      if (command.toUpperCase() === 'Z') {
        if (!current) throw new Error('Z without a shape');
        if (current.closed) throw new Error('Z twice');
        current.closed = true;
        point = current.start;
        lastControl = null;
        continue;
      }
    } else if (command === '' || command.toUpperCase() === 'Z') {
      throw new Error(`number "${token}" without a command`);
    }
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const arity = ARITY[upper]!;
    const values = tokens.slice(i, i + arity).map(Number);
    if (values.length < arity || values.some((value) => !Number.isFinite(value)))
      throw new Error(`"${command}" needs ${arity} numbers`);
    i += arity;
    const abs = (x: number, y: number): Point => (relative ? [point[0] + x, point[1] + y] : [x, y]);
    if (upper === 'M') {
      if (current && !current.closed && !options.open)
        throw new Error('a shape is not closed with Z');
      point = abs(values[0]!, values[1]!);
      current = { start: point, segments: [], closed: false };
      subpaths.push(current);
      lastControl = null;
      // Further pairs after M are line-tos.
      command = relative ? 'l' : 'L';
      continue;
    }
    if (!current || current.closed)
      throw new Error(`"${command}" must follow M (start each shape with M)`);
    let segment: Segment;
    if (upper === 'L') segment = { kind: 'L', to: abs(values[0]!, values[1]!) };
    else if (upper === 'H')
      segment = { kind: 'L', to: [relative ? point[0] + values[0]! : values[0]!, point[1]] };
    else if (upper === 'V')
      segment = { kind: 'L', to: [point[0], relative ? point[1] + values[0]! : values[0]!] };
    else if (upper === 'C')
      segment = {
        kind: 'C',
        c1: abs(values[0]!, values[1]!),
        c2: abs(values[2]!, values[3]!),
        to: abs(values[4]!, values[5]!),
      };
    else if (upper === 'S')
      segment = {
        kind: 'C',
        c1: reflect(lastControl?.kind === 'C' ? lastControl.point : null, point),
        c2: abs(values[0]!, values[1]!),
        to: abs(values[2]!, values[3]!),
      };
    else if (upper === 'Q')
      segment = { kind: 'Q', c: abs(values[0]!, values[1]!), to: abs(values[2]!, values[3]!) };
    else
      segment = {
        kind: 'Q',
        c: reflect(lastControl?.kind === 'Q' ? lastControl.point : null, point),
        to: abs(values[0]!, values[1]!),
      };
    current.segments.push(segment);
    lastControl =
      segment.kind === 'C'
        ? { kind: 'C', point: segment.c2 }
        : segment.kind === 'Q'
          ? { kind: 'Q', point: segment.c }
          : null;
    point = segment.to;
  }
  if (subpaths.length === 0) throw new Error('no shape');
  return subpaths;
}

function reflect(control: Point | null, point: Point): Point {
  return control ? [2 * point[0] - control[0], 2 * point[1] - control[1]] : point;
}

const num = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
const pair = (point: Point) => `${num(point[0])} ${num(point[1])}`;

/** The canonical absolute form, one decimal (what the app renders). */
export function formatPath(subpaths: readonly Subpath[]): string {
  return subpaths
    .map(
      (subpath) =>
        `M${pair(subpath.start)}` +
        subpath.segments
          .map((segment) =>
            segment.kind === 'L'
              ? `L${pair(segment.to)}`
              : segment.kind === 'C'
                ? `C${pair(segment.c1)} ${pair(segment.c2)} ${pair(segment.to)}`
                : `Q${pair(segment.c)} ${pair(segment.to)}`,
          )
          .join('') +
        (subpath.closed ? 'Z' : ''),
    )
    .join('');
}

const STEPS = 12;

/** Each shape as a polygon (curves sampled), for containment, distances and areas. */
export function flatten(subpaths: readonly Subpath[]): Point[][] {
  return subpaths.map((subpath) => {
    const points: Point[] = [subpath.start];
    let from = subpath.start;
    for (const segment of subpath.segments) {
      if (segment.kind === 'L') points.push(segment.to);
      else
        for (let step = 1; step <= STEPS; step++) {
          const t = step / STEPS;
          const u = 1 - t;
          points.push(
            segment.kind === 'C'
              ? [
                  u * u * u * from[0] +
                    3 * u * u * t * segment.c1[0] +
                    3 * u * t * t * segment.c2[0] +
                    t * t * t * segment.to[0],
                  u * u * u * from[1] +
                    3 * u * u * t * segment.c1[1] +
                    3 * u * t * t * segment.c2[1] +
                    t * t * t * segment.to[1],
                ]
              : [
                  u * u * from[0] + 2 * u * t * segment.c[0] + t * t * segment.to[0],
                  u * u * from[1] + 2 * u * t * segment.c[1] + t * t * segment.to[1],
                ],
          );
        }
      from = segment.to;
    }
    return points;
  });
}
