import type { Weights } from '../shader/presets';
import type { SceneData } from '../types';

/** Everything needed to draw one frame. Filled in by the main loop. */
export interface Frame {
  a: SceneData;
  /** The next scene while crossfading, otherwise null. */
  b: SceneData | null;
  mix: number;
  zoomA: number;
  zoomB: number;
  weights: Weights;
  /** Parallax direction, each axis -1 to 1. */
  pointerX: number;
  pointerY: number;
  parallax: number;
  time: number;
  /** Time in whole ticks, for effects that should step rather than flow. */
  tick: number;
  staticAmount: number;
  black: number;
}

export interface SceneRenderer {
  readonly kind: 'webgl' | 'fallback';
  resize(): void;
  /** Start loading a scene's image if it is not loaded yet. */
  preload(scene: SceneData): void;
  isReady(scene: SceneData): boolean;
  /** True while the renderer is animating something of its own (e.g. an image arriving). */
  busy(): boolean;
  /** Render resolution scale, 1 = full. Lower trades sharpness for speed. */
  setQuality(scale: number): void;
  /** Free images for scenes other than these. */
  keepOnly(scenes: SceneData[]): void;
  render(frame: Frame): void;
}

export function imageUrl(scene: SceneData, width: number, format: 'avif' | 'webp'): string {
  return `${scene.mediaBase}/${scene.image}/${width}.${format}`;
}

export function depthUrl(scene: SceneData): string {
  return `${scene.mediaBase}/${scene.image}/depth.webp`;
}

export function thumbUrl(scene: SceneData): string {
  return `${scene.mediaBase}/${scene.image}/thumb.webp`;
}

/** Smallest available width that still covers `needed` device pixels. */
export function pickWidth(widths: number[], needed: number): number {
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((w) => w >= needed) ?? sorted[sorted.length - 1]!;
}

/** Image width, in device pixels, needed to cover a canvas without upscaling. */
export function neededWidth(canvasW: number, canvasH: number, imageAspect: number): number {
  return Math.max(canvasW, canvasH * imageAspect);
}

let avifSupported = true;

/** Loads and decodes an image, preferring AVIF and falling back to WebP once. */
export async function loadSceneImage(scene: SceneData, width: number): Promise<HTMLImageElement> {
  if (avifSupported) {
    try {
      return await loadImage(imageUrl(scene, width, 'avif'));
    } catch {
      avifSupported = false;
    }
  }
  return loadImage(imageUrl(scene, width, 'webp'));
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}
