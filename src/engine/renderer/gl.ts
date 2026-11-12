import { Mesh, Program, Renderer, Texture, Triangle, type OGLRenderingContext } from 'ogl';
import fragment from '../shader/era.frag.glsl?raw';
import vertex from '../shader/era.vert.glsl?raw';
import { WEIGHT_KEYS, type WeightKey } from '../shader/presets';
import type { SceneData } from '../types';
import {
  depthUrl,
  loadImage,
  loadSceneImage,
  neededWidth,
  pickWidth,
  type Frame,
  type SceneRenderer,
} from './types';

interface Entry {
  status: 'loading' | 'ready' | 'failed';
  color: Texture | null;
  depth: Texture | null;
  width: number;
  height: number;
  /** Which file size is loaded, so a bigger one can replace it after a resize. */
  loadedWidth: number;
}

/** Weights handled outside the shader. */
const NOT_UNIFORMS: WeightKey[] = ['stutter', 'stamp'];
const SHADER_WEIGHTS = WEIGHT_KEYS.filter((k) => !NOT_UNIFORMS.includes(k));
const uniformName = (k: WeightKey) => `w${k[0]!.toUpperCase()}${k.slice(1)}`;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export class GLRenderer implements SceneRenderer {
  readonly kind = 'webgl' as const;
  private renderer: Renderer;
  private gl: OGLRenderingContext;
  private program: Program;
  private mesh: Mesh;
  private blank: Texture;
  private entries = new Map<string, Entry>();
  /** 0 while the current image is missing, rising to 1 once it has arrived. */
  private reveal = 0;
  private lastTime = 0;
  /** Resolution scale, lowered by the main loop on devices that cannot keep up. */
  private quality = 1;
  /** True while the browser has taken the GPU context away (e.g. a phone tab in the background). */
  private lost = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer({
      canvas,
      dpr: this.dpr(),
      alpha: false,
      depth: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 1);

    this.blank = new Texture(this.gl, { generateMipmaps: false });

    const uniforms: Record<string, { value: unknown }> = {
      tA: { value: this.blank },
      tB: { value: this.blank },
      tDepthA: { value: this.blank },
      tDepthB: { value: this.blank },
      uSizeA: { value: [1, 1] },
      uSizeB: { value: [1, 1] },
      uHasDepthA: { value: 0 },
      uHasDepthB: { value: 0 },
      uRes: { value: [1, 1] },
      uDpr: { value: 1 },
      uMix: { value: 0 },
      uZoomA: { value: 1 },
      uZoomB: { value: 1 },
      uFocusA: { value: [0.5, 0.5] },
      uFocusB: { value: [0.5, 0.5] },
      uFitA: { value: 0 },
      uFitB: { value: 0 },
      uPointer: { value: [0, 0] },
      uParallax: { value: 0 },
      uTime: { value: 0 },
      uFrame: { value: 0 },
      uStatic: { value: 0 },
      uBlack: { value: 0 },
    };
    for (const k of SHADER_WEIGHTS) uniforms[uniformName(k)] = { value: 0 };

    this.program = new Program(this.gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false });
    this.mesh = new Mesh(this.gl, { geometry: new Triangle(this.gl), program: this.program });

    // A lost context (common on phones after the tab was in the background)
    // cannot be repaired piecemeal; reloading restores the scroll position.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());

    this.resize();
  }

  private dpr(): number {
    return Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.5 : 1.75) * this.quality;
  }

  /** Sets the render resolution scale (1 = full). */
  setQuality(scale: number): void {
    if (scale === this.quality) return;
    this.quality = scale;
    this.resize();
  }

  resize(): void {
    this.renderer.dpr = this.dpr();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const u = this.program.uniforms;
    u.uRes.value = [this.gl.drawingBufferWidth, this.gl.drawingBufferHeight];
    u.uDpr.value = this.renderer.dpr;
  }

  private targetWidth(scene: SceneData): number {
    const aspect = scene.media.width / scene.media.height;
    // On a phone held upright a landscape image is mostly cropped away, so the
    // largest file would be wasted bandwidth and memory.
    const cap = window.innerWidth < 800 ? 1600 : Infinity;
    const needed = Math.min(cap, neededWidth(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, aspect));
    return pickWidth(scene.media.widths, needed);
  }

  preload(scene: SceneData): void {
    const target = this.targetWidth(scene);
    const existing = this.entries.get(scene.image);
    if (existing && (existing.status === 'loading' || existing.loadedWidth >= target)) return;
    if (existing?.status === 'failed') return;

    const entry: Entry = existing ?? {
      status: 'loading',
      color: null,
      depth: null,
      width: scene.media.width,
      height: scene.media.height,
      loadedWidth: 0,
    };
    const wasReady = entry.status === 'ready';
    if (!wasReady) entry.status = 'loading';
    this.entries.set(scene.image, entry);

    const colour = loadSceneImage(scene, target);
    const depth = scene.media.depth && !entry.depth ? loadImage(depthUrl(scene)).catch(() => null) : null;

    Promise.all([colour, depth])
      .then(([img, depthImg]) => {
        // The entry may have been freed while the image was downloading.
        if (this.entries.get(scene.image) !== entry) return;
        if (entry.color) this.gl.deleteTexture(entry.color.texture);
        entry.color = new Texture(this.gl, { image: img, generateMipmaps: false });
        entry.width = img.naturalWidth;
        entry.height = img.naturalHeight;
        entry.loadedWidth = target;
        if (depthImg) entry.depth = new Texture(this.gl, { image: depthImg, generateMipmaps: false });
        entry.status = 'ready';
      })
      .catch(() => {
        if (!wasReady) entry.status = 'failed';
      });
  }

  isReady(scene: SceneData): boolean {
    return this.entries.get(scene.image)?.status === 'ready';
  }

  busy(): boolean {
    return this.reveal < 1;
  }

  keepOnly(scenes: SceneData[]): void {
    const keep = new Set(scenes.map((s) => s.image));
    for (const [id, entry] of this.entries) {
      if (keep.has(id)) continue;
      if (entry.color) this.gl.deleteTexture(entry.color.texture);
      if (entry.depth) this.gl.deleteTexture(entry.depth.texture);
      this.entries.delete(id);
    }
  }

  render(f: Frame): void {
    if (this.lost) return;
    const u = this.program.uniforms;
    const a = this.entries.get(f.a.image);
    const b = f.b ? this.entries.get(f.b.image) : undefined;
    const aReady = a?.status === 'ready' && a.color;
    const bReady = b?.status === 'ready' && b.color;

    u.tA.value = aReady ? a.color : this.blank;
    u.tDepthA.value = aReady && a.depth ? a.depth : this.blank;
    u.uHasDepthA.value = aReady && a.depth ? 1 : 0;
    if (aReady) u.uSizeA.value = [a.width, a.height];

    u.tB.value = bReady ? b.color : this.blank;
    u.tDepthB.value = bReady && b.depth ? b.depth : this.blank;
    u.uHasDepthB.value = bReady && b.depth ? 1 : 0;
    if (bReady) u.uSizeB.value = [b.width, b.height];

    // Until the next image has arrived, hold on the current one.
    u.uMix.value = bReady ? f.mix : 0;
    u.uZoomA.value = f.zoomA;
    u.uZoomB.value = f.zoomB;
    // Framing depends on the screen's shape. Textures are flipped, so y counts from the bottom.
    const tall = this.gl.drawingBufferHeight > this.gl.drawingBufferWidth;
    const fa = f.a.framing;
    u.uFocusA.value = [fa.focus[0], 1 - fa.focus[1]];
    u.uFitA.value = tall ? fa.fitPortrait : fa.fitLandscape;
    if (f.b) {
      const fb = f.b.framing;
      u.uFocusB.value = [fb.focus[0], 1 - fb.focus[1]];
      u.uFitB.value = tall ? fb.fitPortrait : fb.fitLandscape;
    }
    u.uPointer.value = [f.pointerX, f.pointerY];
    u.uParallax.value = f.parallax;
    u.uTime.value = f.time;
    u.uFrame.value = f.tick;
    // An image that has not loaded yet shows as static rather than as a black
    // hole, and the static clears smoothly once it arrives.
    const dt = Math.min(0.1, Math.max(0, f.time - this.lastTime));
    this.lastTime = f.time;
    this.reveal = aReady ? Math.min(1, this.reveal + dt * 2.2) : 0;
    u.uStatic.value = Math.max(f.staticAmount, 1 - this.reveal);
    u.uBlack.value = f.black;
    for (const k of SHADER_WEIGHTS) u[uniformName(k)].value = f.weights[k];

    this.renderer.render({ scene: this.mesh });
  }
}
