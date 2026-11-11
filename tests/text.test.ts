import { describe, expect, it } from 'vitest';
import { formatStamp, formatYear, lookup } from '../src/engine/hud/text';
import { neededWidth, pickWidth } from '../src/engine/renderer/types';
import { ui } from '../src/i18n';
import { LOCALES } from '../src/lib/constants';

describe('formatYear', () => {
  it('writes BC years with the language suffix', () => {
    expect(formatYear(-300, ui.sq)).toBe('300 p.e.s.');
    expect(formatYear(-300, ui.en)).toBe('300 BC');
    expect(formatYear(1912, ui.sq)).toBe('1912');
  });
});

describe('formatStamp', () => {
  it('formats camcorder dates', () => {
    expect(formatStamp('1998-03-05', 1998)).toBe('MAR 05 1998');
    expect(formatStamp('1996-07', 1996)).toBe('JUL 1996');
    expect(formatStamp('1991', 1991)).toBe('1991');
    expect(formatStamp(undefined, 1999)).toBe('1999');
  });
});

describe('interface strings', () => {
  it('finds strings by key', () => {
    expect(lookup(ui.en, 'source.tab')).toBe('Source');
    expect(lookup(ui.sq, 'source.tab')).toBe('Burimi');
  });

  it('has the same keys in every language', () => {
    const shape = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? shape(v).map((s) => `${k}.${s}`) : [k]));
    const reference = shape(ui.sq).sort();
    for (const locale of LOCALES) expect(shape(ui[locale]).sort(), locale).toEqual(reference);
  });
});

describe('image sizes', () => {
  it('picks the smallest file that covers the screen', () => {
    expect(pickWidth([960, 1600, 2560], 800)).toBe(960);
    expect(pickWidth([960, 1600, 2560], 1300)).toBe(1600);
    expect(pickWidth([960, 1600, 2560], 4000)).toBe(2560);
  });

  it('needs more width when the screen is taller than the image', () => {
    expect(neededWidth(1280, 720, 16 / 9)).toBeCloseTo(1280, 0);
    expect(neededWidth(400, 800, 16 / 9)).toBeCloseTo(1422.2, 0);
  });
});
