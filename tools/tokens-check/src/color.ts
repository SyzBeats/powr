/**
 * Colour maths for the token gate (technical concept §8.9.3, NFR-A11Y-05/10): WCAG 2.2 relative
 * luminance and contrast, alpha compositing, colour-vision-deficiency simulation (Machado,
 * Oliveira and Fernandes 2009, severity 1.0, in linear sRGB) and the CIEDE2000 colour difference.
 */

export type Rgb = readonly [r: number, g: number, b: number];

/** `#rrggbb` → 0–255 channels. */
export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const v = clamp(value, 0, 1);
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
}

/** WCAG 2.2 relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio (1–21). */
export function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** `fg` at `alpha` over an opaque `bg` (sRGB compositing, as browsers paint it). */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha)) as unknown as Rgb;
}

export const DEFICIENCIES = ['protanopia', 'deuteranopia', 'tritanopia'] as const;
export type Deficiency = (typeof DEFICIENCIES)[number];

/** Machado et al. 2009, severity 1.0 (linear RGB). */
const MACHADO: Readonly<Record<Deficiency, readonly (readonly number[])[]>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** How a colour looks with a full (dichromatic) colour-vision deficiency. */
export function simulate(rgb: Rgb, deficiency: Deficiency): Rgb {
  const linear = rgb.map(toLinear);
  return MACHADO[deficiency].map((row) =>
    fromLinear(row.reduce((sum, weight, i) => sum + weight * linear[i]!, 0)),
  ) as unknown as Rgb;
}

const labF = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * (t / 116) + 16 / 116);

/** sRGB → CIE L*a*b* (D65). */
function toLab(rgb: Rgb): readonly [l: number, a: number, b: number] {
  const [r, g, b] = rgb.map(toLinear) as unknown as Rgb;
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const [fx, fy, fz] = [labF(x), labF(y), labF(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference (Sharma, Wu and Dalal 2005). */
export function deltaE2000(first: Rgb, second: Rgb): number {
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  const rad = Math.PI / 180;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * rad);
  const lMean = (l1 + l2) / 2;
  const cpMean = (c1p + c2p) / 2;
  let hpMean = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpMean = (h1p + h2p) / 2;
    else hpMean = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hpMean - 30) * rad) +
    0.24 * Math.cos(2 * hpMean * rad) +
    0.32 * Math.cos((3 * hpMean + 6) * rad) -
    0.2 * Math.cos((4 * hpMean - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpMean - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -Math.sin(2 * dTheta * rad) * rc;
  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}
