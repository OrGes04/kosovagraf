import type { Treatment } from '../../lib/constants';

/**
 * Every era treatment is a set of weights, each 0 (off) to 1 (full).
 * All-zero means a clean, sharp, full-colour image, which is why "effects off"
 * and reduced motion can simply scale these down.
 */
export const WEIGHT_KEYS = [
  'parchment', // image printed as ink on parchment
  'flicker', // candlelight flicker at the edges
  'fade', // faded photograph: lifted blacks, low contrast
  'grain',
  'dust', // still specks and blotches on a print
  'scratches', // moving film scratches and specks
  'edgeWear', // worn, irregular borders
  'sepia',
  'desaturate', // 1 = black and white
  'jitter', // film gate weave and exposure flicker
  'stutter', // 1 = motion steps at ~18fps
  'scanlines',
  'curvature', // curved CRT glass
  'fringe', // RGB fringing
  'tracking', // VHS tracking errors
  'bleed', // VHS colour bleed
  'vignette',
  'stamp', // camcorder date stamp (a DOM overlay, not in the shader)
] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;

export function zeroWeights(): Weights {
  const w = {} as Weights;
  for (const k of WEIGHT_KEYS) w[k] = 0;
  return w;
}

function preset(values: Partial<Weights>): Weights {
  return { ...zeroWeights(), ...values };
}

export const PRESETS: Record<Treatment, Weights> = {
  // Antiquity and the Middle Ages: engravings and maps on parchment, by candlelight.
  parchment: preset({
    parchment: 0.85,
    flicker: 0.7,
    grain: 0.25,
    edgeWear: 0.55,
    desaturate: 0.35,
    sepia: 0.25,
    vignette: 0.75,
  }),
  // Ottoman era to 1912: faded photographs.
  fadedPhoto: preset({
    fade: 0.8,
    grain: 0.7,
    dust: 0.75,
    edgeWear: 0.85,
    sepia: 0.6,
    desaturate: 0.9,
    vignette: 0.6,
  }),
  // 1912 to 1945: old film.
  film: preset({
    sepia: 0.75,
    desaturate: 1,
    scratches: 0.8,
    grain: 0.6,
    jitter: 0.7,
    stutter: 1,
    fade: 0.25,
    vignette: 0.6,
  }),
  // 1945 to 1989: black-and-white CRT television.
  crt: preset({
    desaturate: 1,
    scanlines: 0.8,
    curvature: 0.75,
    fringe: 0.6,
    grain: 0.3,
    vignette: 0.5,
  }),
  // The 1990s: VHS.
  vhs: preset({
    tracking: 0.7,
    bleed: 0.8,
    fringe: 0.35,
    scanlines: 0.25,
    grain: 0.3,
    desaturate: 0.15,
    vignette: 0.25,
    stamp: 1,
  }),
  // 1998 to 1999, the war: the VHS look without its showy parts (decision D48).
  // No tracking glitches, colour bleed or date stamp; only grain and a little softness.
  vhsQuiet: preset({
    scanlines: 0.15,
    fringe: 0.1,
    grain: 0.3,
    desaturate: 0.2,
    vignette: 0.3,
  }),
  // 1999 onwards: the effects leave one by one.
  vhsFading: preset({
    bleed: 0.4,
    tracking: 0.15,
    grain: 0.15,
    vignette: 0.15,
  }),
  digital: preset({
    grain: 0.06,
  }),
  clean: preset({}),
};

/** Writes a + (b - a) * t into out and returns it. */
export function lerpWeights(a: Weights, b: Weights, t: number, out: Weights): Weights {
  for (const k of WEIGHT_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/**
 * Motion-heavy weights. With prefers-reduced-motion these are turned almost
 * off, while the still parts of a treatment (colour, grain texture) remain.
 */
const MOTION_KEYS: WeightKey[] = ['flicker', 'scratches', 'jitter', 'stutter', 'tracking'];

export function applyPreferences(
  w: Weights,
  opts: { effects: boolean; reducedMotion: boolean },
  out: Weights,
): Weights {
  for (const k of WEIGHT_KEYS) out[k] = opts.effects ? w[k] : 0;
  if (opts.reducedMotion) {
    for (const k of MOTION_KEYS) out[k] *= 0.15;
    out.stutter = 0;
  }
  return out;
}
