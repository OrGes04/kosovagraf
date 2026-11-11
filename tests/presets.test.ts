import { describe, expect, it } from 'vitest';
import { TREATMENTS } from '../src/lib/constants';
import {
  PRESETS,
  WEIGHT_KEYS,
  applyPreferences,
  lerpWeights,
  zeroWeights,
} from '../src/engine/shader/presets';

describe('presets', () => {
  it('defines every treatment with every weight between 0 and 1', () => {
    for (const name of TREATMENTS) {
      const p = PRESETS[name];
      expect(p, name).toBeDefined();
      for (const k of WEIGHT_KEYS) {
        expect(p[k], `${name}.${k}`).toBeGreaterThanOrEqual(0);
        expect(p[k], `${name}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps "clean" completely clean', () => {
    expect(PRESETS.clean).toEqual(zeroWeights());
  });

  it('blends between two treatments', () => {
    const out = zeroWeights();
    lerpWeights(PRESETS.film, PRESETS.crt, 0, out);
    expect(out).toEqual(PRESETS.film);
    lerpWeights(PRESETS.film, PRESETS.crt, 1, out);
    expect(out).toEqual(PRESETS.crt);
    lerpWeights(PRESETS.film, PRESETS.crt, 0.5, out);
    expect(out.sepia).toBeCloseTo(PRESETS.film.sepia / 2, 5);
    expect(out.scanlines).toBeCloseTo(PRESETS.crt.scanlines / 2, 5);
  });

  it('turns everything off when effects are off', () => {
    const out = zeroWeights();
    applyPreferences(PRESETS.vhs, { effects: false, reducedMotion: false }, out);
    expect(out).toEqual(zeroWeights());
  });

  it('calms motion but keeps the still look under reduced motion', () => {
    const out = zeroWeights();
    applyPreferences(PRESETS.film, { effects: true, reducedMotion: true }, out);
    expect(out.stutter).toBe(0);
    expect(out.jitter).toBeLessThan(PRESETS.film.jitter * 0.2);
    expect(out.sepia).toBe(PRESETS.film.sepia);
  });
});
