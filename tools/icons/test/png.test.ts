import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { colorAt, COLORS } from '../src/artwork.ts';
import { encodePng } from '../src/png.ts';

describe('icon generator', () => {
  it('writes a valid PNG signature, header and image data', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);
    const png = encodePng(2, 1, rgba);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(1);
    const idatLength = png.readUInt32BE(33);
    const pixels = inflateSync(png.subarray(41, 41 + idatLength));
    expect([...pixels]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 128]);
  });

  it('keeps the maskable motif inside the safe zone and corners transparent when rounded', () => {
    expect(colorAt(0.01, 0.01, { rounded: true, scale: 1 })).toBeNull();
    expect(colorAt(0.01, 0.01, { rounded: false, scale: 0.8 })).toEqual(COLORS.tile);
    expect(colorAt(0.5, 0.5, { rounded: false, scale: 0.8 })).toEqual(COLORS.bar);
    expect(colorAt(0.12, 0.5, { rounded: false, scale: 0.8 })).toEqual(COLORS.tile);
  });
});
