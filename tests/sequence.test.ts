import { describe, expect, it } from 'vitest';
import {
  buildItems,
  captionAt,
  crossfade,
  locate,
  odometer,
  roll,
  rulerAt,
  yearAt,
  HOLD,
  type Item,
} from '../src/engine/sequence';
import { TITLE_YEAR } from '../src/lib/constants';
import type { SceneData } from '../src/engine/types';

const scene = (year: number) => ({ year }) as SceneData;

describe('buildItems', () => {
  it('puts the title first, then one item per scene', () => {
    const items = buildItems([scene(-300), scene(1912)]);
    expect(items.map((i) => i.kind)).toEqual(['title', 'scene', 'scene']);
    expect(items[0]!.year).toBe(TITLE_YEAR);
    expect(items[0]!.scene).toBe(0);
    expect(items[2]!.scene).toBe(1);
  });
});

describe('locate', () => {
  const starts = [0, 1000, 3000];
  const sizes = [1000, 2000, 2000];

  it('finds the item and progress for an offset', () => {
    expect(locate(starts, sizes, 0)).toEqual({ index: 0, t: 0 });
    expect(locate(starts, sizes, 500)).toEqual({ index: 0, t: 0.5 });
    expect(locate(starts, sizes, 1000)).toEqual({ index: 1, t: 0 });
    expect(locate(starts, sizes, 2999)).toEqual({ index: 1, t: 0.9995 });
    expect(locate(starts, sizes, 4000)).toEqual({ index: 2, t: 0.5 });
  });

  it('clamps before the start and past the end', () => {
    expect(locate(starts, sizes, -50)).toEqual({ index: 0, t: 0 });
    expect(locate(starts, sizes, 99999)).toEqual({ index: 2, t: 1 });
  });
});

describe('year and ruler', () => {
  const items: Item[] = [
    { kind: 'title', scene: 0, year: -1000, span: 1 },
    { kind: 'scene', scene: 0, year: -300, span: 2 },
    { kind: 'scene', scene: 1, year: 1912, span: 2 },
  ];

  it('holds the year, then rolls to the next scene', () => {
    expect(yearAt(items, { index: 1, t: 0 })).toBe(-300);
    expect(yearAt(items, { index: 1, t: HOLD })).toBe(-300);
    expect(yearAt(items, { index: 1, t: 1 })).toBe(1912);
    const mid = yearAt(items, { index: 1, t: (HOLD + 1) / 2 });
    expect(mid).toBeCloseTo((-300 + 1912) / 2, 5);
  });

  it('is continuous across item boundaries', () => {
    const before = yearAt(items, { index: 0, t: 1 });
    const after = yearAt(items, { index: 1, t: 0 });
    expect(before).toBe(after);
  });

  it('stays on the last year at the end', () => {
    expect(yearAt(items, { index: 2, t: 1 })).toBe(1912);
    expect(rulerAt({ index: 2, t: 1 }, items.length)).toBe(2);
  });

  it('moves the ruler exactly one stop per item', () => {
    expect(rulerAt({ index: 1, t: 0 }, items.length)).toBe(1);
    expect(rulerAt({ index: 1, t: 1 }, items.length)).toBe(2);
  });
});

describe('transitions', () => {
  it('never crossfades or rolls before their start points', () => {
    expect(crossfade(0.5)).toBe(0);
    expect(crossfade(1)).toBe(1);
    expect(roll(0.2)).toBe(0);
    expect(roll(1)).toBe(1);
  });
});

describe('captionAt', () => {
  it('shows captions in order and none at the edges', () => {
    expect(captionAt(0, 3)).toBe(-1);
    expect(captionAt(0.06, 3)).toBe(0);
    expect(captionAt(0.4, 3)).toBe(1);
    expect(captionAt(0.79, 3)).toBe(2);
    expect(captionAt(0.9, 3)).toBe(-1);
    expect(captionAt(0.4, 0)).toBe(-1);
  });
});

describe('odometer', () => {
  it('shows whole years as plain digits', () => {
    expect(odometer(1912, 4)).toEqual([1, 9, 1, 2]);
    expect(odometer(-300, 4)).toEqual([0, 3, 0, 0]);
  });

  it('turns only the last wheel for a small step', () => {
    const w = odometer(1912.5, 4);
    expect(w[0]).toBe(1);
    expect(w[1]).toBe(9);
    expect(w[2]).toBe(1);
    expect(w[3]).toBeCloseTo(2.5, 5);
  });

  it('carries through every wheel when rolling over', () => {
    const w = odometer(1999.5, 4);
    expect(w[0]).toBeCloseTo(1.5, 5);
    expect(w[1]).toBeCloseTo(9.5, 5);
    expect(w[2]).toBeCloseTo(9.5, 5);
    expect(w[3]).toBeCloseTo(9.5, 5);
  });
});
