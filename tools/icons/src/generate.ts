import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { colorAt, svgIcon } from './artwork.ts';
import { encodePng } from './png.ts';

/**
 * Generates the placeholder app icons (own artwork, recorded in assets-inventory.yaml).
 * Run with `pnpm icons`; the output is committed.
 */
const publicDir = fileURLToPath(new URL('../../../apps/web/public/', import.meta.url));
const SUPERSAMPLE = 4;

function render(size: number, options: { rounded: boolean; scale: number }): Buffer {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const color = colorAt(
            (x + (sx + 0.5) / SUPERSAMPLE) / size,
            (y + (sy + 0.5) / SUPERSAMPLE) / size,
            options,
          );
          if (!color) continue;
          for (let c = 0; c < 4; c++) sum[c] = (sum[c] ?? 0) + (color[c] ?? 0);
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = (sum[3] ?? 0) / samples;
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++)
        rgba[offset + c] = alpha === 0 ? 0 : Math.round((sum[c] ?? 0) / samples / (alpha / 255));
      rgba[offset + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(`${publicDir}icons`, { recursive: true });
const outputs: [string, Buffer | string][] = [
  ['icons/icon-192.png', render(192, { rounded: true, scale: 1 })],
  ['icons/icon-512.png', render(512, { rounded: true, scale: 1 })],
  // Maskable: full-bleed tile, motif inside the 80 % safe zone.
  ['icons/maskable-512.png', render(512, { rounded: false, scale: 0.8 })],
  ['icons/apple-touch-icon-180.png', render(180, { rounded: false, scale: 0.9 })],
  ['favicon.svg', svgIcon()],
];
for (const [file, data] of outputs) {
  writeFileSync(`${publicDir}${file}`, data);
  console.log(`wrote apps/web/public/${file}`);
}
