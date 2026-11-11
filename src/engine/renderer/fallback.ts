import type { SceneData } from '../types';
import { imageUrl, pickWidth, type Frame, type SceneRenderer } from './types';

/**
 * Used when WebGL is not available. Two plain images crossfade and zoom; there
 * are no era treatments, but the whole story still works.
 */
export class FallbackRenderer implements SceneRenderer {
  readonly kind = 'fallback' as const;
  private imgA: HTMLImageElement;
  private imgB: HTMLImageElement;
  private shownA = '';
  private shownB = '';

  constructor(private root: HTMLElement) {
    root.hidden = false;
    const imgs = root.querySelectorAll('img');
    this.imgA = imgs[0]!;
    this.imgB = imgs[1]!;
  }

  private url(scene: SceneData): string {
    const needed = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 1.5);
    return imageUrl(scene, pickWidth(scene.media.widths, needed), 'webp');
  }

  resize(): void {}

  preload(scene: SceneData): void {
    new Image().src = this.url(scene);
  }

  isReady(): boolean {
    return true;
  }

  keepOnly(): void {}

  render(f: Frame): void {
    if (this.shownA !== f.a.image) {
      this.shownA = f.a.image;
      this.imgA.src = this.url(f.a);
    }
    const b = f.b?.image ?? '';
    if (b && this.shownB !== b) {
      this.shownB = b;
      this.imgB.src = this.url(f.b!);
    }
    this.imgA.style.transform = `scale(${f.zoomA.toFixed(4)})`;
    this.imgB.style.transform = `scale(${f.zoomB.toFixed(4)})`;
    this.imgB.style.opacity = b ? f.mix.toFixed(3) : '0';
    this.root.style.opacity = (1 - Math.max(f.black, f.staticAmount)).toFixed(3);
  }
}
