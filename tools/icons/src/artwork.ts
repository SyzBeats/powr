/**
 * Original placeholder logo: a loaded barbell on a dark tile. Coordinates are in a 0..1 unit
 * square; `scale` shrinks the motif for the maskable icon's safe zone.
 */
export const COLORS = {
  tile: [16, 18, 20, 255],
  plate: [143, 176, 255, 255],
  bar: [240, 241, 242, 255],
} as const;

type Rgba = readonly [number, number, number, number];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const BAR: Box = { x: 0.14, y: 0.475, w: 0.72, h: 0.05, r: 0.02 };
const PLATES: Box[] = [
  { x: 0.2, y: 0.3, w: 0.08, h: 0.4, r: 0.03 },
  { x: 0.29, y: 0.36, w: 0.06, h: 0.28, r: 0.025 },
  { x: 0.65, y: 0.36, w: 0.06, h: 0.28, r: 0.025 },
  { x: 0.72, y: 0.3, w: 0.08, h: 0.4, r: 0.03 },
];

export function colorAt(
  u: number,
  v: number,
  options: { rounded: boolean; scale: number },
): Rgba | null {
  if (options.rounded && !inRoundedBox(u, v, { x: 0, y: 0, w: 1, h: 1, r: 0.22 })) return null;
  const mu = 0.5 + (u - 0.5) / options.scale;
  const mv = 0.5 + (v - 0.5) / options.scale;
  if (PLATES.some((plate) => inRoundedBox(mu, mv, plate))) return COLORS.plate;
  if (inRoundedBox(mu, mv, BAR)) return COLORS.bar;
  return COLORS.tile;
}

function inRoundedBox(u: number, v: number, box: Box): boolean {
  if (u < box.x || u > box.x + box.w || v < box.y || v > box.y + box.h) return false;
  const cx = Math.min(Math.max(u, box.x + box.r), box.x + box.w - box.r);
  const cy = Math.min(Math.max(v, box.y + box.r), box.y + box.h - box.r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= box.r ** 2;
}

/** The same artwork as SVG, used for the favicon. */
export function svgIcon(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    rect({ x: 0, y: 0, w: 1, h: 1, r: 0.22 }, hex(COLORS.tile)),
    rect(BAR, hex(COLORS.bar)),
    ...PLATES.map((plate) => rect(plate, hex(COLORS.plate))),
    '</svg>',
    '',
  ].join('');
}

function rect(box: Box, fill: string): string {
  return `<rect x="${box.x * 64}" y="${box.y * 64}" width="${box.w * 64}" height="${box.h * 64}" rx="${box.r * 64}" fill="${fill}"/>`;
}

function hex(color: Rgba): string {
  return `#${color
    .slice(0, 3)
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')}`;
}
