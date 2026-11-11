/**
 * The sequence: how scenes map onto the scroll track, and how any scroll
 * position becomes "which scene, how far through it, what year".
 *
 * Pure functions with no DOM access, so they can be unit tested.
 */
import { TITLE_YEAR } from '../lib/constants';
import type { SceneData } from './types';

export interface Item {
  kind: 'title' | 'scene';
  /** Index into the scenes array. The title item shows the first scene's image. */
  scene: number;
  year: number;
  /** Scroll length in viewport heights. */
  span: number;
}

/** A position on the track: item index plus progress through that item, 0 to 1. */
export interface Position {
  index: number;
  t: number;
}

export const TITLE_SPAN = 1;
export const SCENE_SPAN = 2.4;

/** Portion of an item during which its year holds still before rolling on. */
export const HOLD = 0.6;
/** Where the image crossfade to the next item begins. */
export const FADE_START = 0.82;
/** Where the treatment starts blending towards the next item's. */
export const TREATMENT_START = 0.5;
/** Captions are spread across this part of an item. */
export const CAPTION_START = 0.05;
export const CAPTION_END = 0.8;

export function buildItems(scenes: SceneData[]): Item[] {
  const items: Item[] = [{ kind: 'title', scene: 0, year: TITLE_YEAR, span: TITLE_SPAN }];
  scenes.forEach((s, i) => items.push({ kind: 'scene', scene: i, year: s.year, span: SCENE_SPAN }));
  return items;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(a: number, b: number, v: number): number {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
}

/**
 * Finds the item under scroll offset y.
 * starts[i] is the offset where item i begins; sizes[i] is its scroll length.
 */
export function locate(starts: number[], sizes: number[], y: number): Position {
  const n = starts.length;
  if (n === 0) return { index: 0, t: 0 };
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return { index: lo, t: clamp01((y - starts[lo]!) / Math.max(1, sizes[lo]!)) };
}

/** How far the year (and the ruler) has moved from this item towards the next, 0 to 1. */
export function roll(t: number): number {
  return smoothstep(HOLD, 1, t);
}

/** Image crossfade amount towards the next item. */
export function crossfade(t: number): number {
  return smoothstep(FADE_START, 1, t);
}

/** Treatment blend amount towards the next item. */
export function treatmentMix(t: number): number {
  return smoothstep(TREATMENT_START, 1, t);
}

/** The (fractional) year at a position. Holds on each scene, then rolls to the next. */
export function yearAt(items: Item[], pos: Position): number {
  const a = items[pos.index]!;
  const b = items[pos.index + 1];
  if (!b) return a.year;
  return a.year + (b.year - a.year) * roll(pos.t);
}

/**
 * Ruler coordinate: item i sits at u = i, and the ruler slides to i + 1 while
 * the year rolls. One unit of u is one stop on the timeline.
 */
export function rulerAt(pos: Position, count: number): number {
  return pos.index >= count - 1 ? count - 1 : pos.index + roll(pos.t);
}

/** Which caption of `count` is showing at progress t, or -1 for none. */
export function captionAt(t: number, count: number): number {
  if (count <= 0 || t < CAPTION_START || t >= CAPTION_END) return -1;
  const i = Math.floor(((t - CAPTION_START) / (CAPTION_END - CAPTION_START)) * count);
  return Math.min(count - 1, i);
}

/**
 * Splits a fractional year into odometer wheels.
 * Returns, for each digit place (most significant first), the wheel position
 * 0 to 10: the lowest wheel turns continuously, and each higher wheel turns
 * only while the wheel below passes from 9 to 0, as on a mechanical counter.
 */
export function odometer(value: number, places: number): number[] {
  const v = Math.abs(value);
  const out: number[] = [];
  for (let k = places - 1; k >= 0; k--) {
    const unit = 10 ** k;
    const digit = Math.floor(v / unit) % 10;
    const below = v % unit; // 0 .. unit
    const carry = k === 0 ? v - Math.floor(v) : Math.max(0, below - (unit - 1));
    out.push(digit + carry);
  }
  return out;
}
