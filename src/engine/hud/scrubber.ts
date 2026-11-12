import type { UiStrings } from '../../i18n';
import type { Locale } from '../../lib/constants';
import { thumbUrl } from '../renderer/types';
import type { Scroll } from '../scroll';
import { clamp01, type Item } from '../sequence';
import type { EraData, SceneData } from '../types';
import { el, formatSceneYear, formatYear } from './text';

const SHOW_FOR = 1000;

/**
 * The time scrubber on the right edge. Hidden at rest; it appears while the
 * page moves, when the mouse nears the edge, or on focus. Dragging the handle
 * (or pressing anywhere on the track) moves through the story, with a bubble
 * showing the scene under the handle. On release it settles on a scene.
 */
export function createScrubber(
  root: HTMLElement,
  deps: {
    scroll: Scroll;
    items: Item[];
    scenes: SceneData[];
    eras: EraData[];
    ui: () => UiStrings;
    lang: () => Locale;
    /** Where a settle lands inside a scene. */
    land: number;
  },
) {
  const { scroll, items, scenes } = deps;
  const eraById = new Map(deps.eras.map((e) => [e.id, e]));
  const marks = root.querySelector<HTMLElement>('.scrub__marks')!;
  const handle = root.querySelector<HTMLElement>('.scrub__handle')!;
  const bubble = root.querySelector<HTMLElement>('.scrub__bubble')!;
  const thumb = root.querySelector<HTMLImageElement>('.scrub__thumb')!;
  const yearEl = root.querySelector<HTMLElement>('.scrub__year')!;
  const chapterEl = root.querySelector<HTMLElement>('.scrub__chapter')!;

  let dragging = false;
  let dragP = 0;
  let focused = false;
  let near = false;
  let visibleUntil = 0;
  let lastP = -1;
  let bubbleItem = -1;
  let enabled = true;

  function buildMarks() {
    marks.textContent = '';
    items.forEach((item, i) => {
      if (item.kind !== 'scene') return;
      const scene = scenes[item.scene]!;
      const prev = items[i - 1];
      const startsChapter = !prev || prev.kind === 'title' || scenes[prev.scene]!.era !== scene.era;
      const mark = el('span', startsChapter ? 'scrub__mark is-chapter' : 'scrub__mark');
      mark.style.top = `${(scroll.progressOf(i) * 100).toFixed(3)}%`;
      marks.append(mark);
    });
  }
  scroll.onMeasure(buildMarks);
  buildMarks();

  function describe(index: number): { year: string; chapter: string } {
    const ui = deps.ui();
    const item = items[index]!;
    const scene = scenes[item.scene]!;
    if (item.kind === 'title') return { year: formatYear(item.year, ui), chapter: ui.site.title };
    const era = eraById.get(scene.era)!;
    return { year: formatSceneYear(scene, ui), chapter: `${era.roman} · ${era.title[deps.lang()]}` };
  }

  function showItem(index: number, force = false) {
    if (index === bubbleItem && !force) return;
    bubbleItem = index;
    const scene = scenes[items[index]!.scene]!;
    const { year, chapter } = describe(index);
    thumb.src = thumbUrl(scene);
    yearEl.textContent = year;
    chapterEl.textContent = chapter;
    root.setAttribute('aria-valuetext', `${year}, ${chapter}`);
    if (dragging) {
      try {
        navigator.vibrate?.(4);
      } catch {
        // Not allowed here; the click is a nicety.
      }
    }
  }

  function pointerP(e: PointerEvent): number {
    const r = root.getBoundingClientRect();
    return clamp01((e.clientY - r.top) / r.height);
  }

  function follow(e: PointerEvent) {
    dragP = pointerP(e);
    scroll.seek(dragP);
  }

  root.addEventListener('pointerdown', (e) => {
    if (!enabled || e.button > 0) return;
    e.preventDefault();
    dragging = true;
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; dragging still works.
    }
    root.classList.add('is-dragging');
    follow(e);
  });
  root.addEventListener('pointermove', (e) => {
    if (dragging) follow(e);
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    visibleUntil = performance.now() + SHOW_FOR;
    // Settle on the nearest scene, just after its start so its caption shows.
    const pos = scroll.locateProgress(dragP);
    const index = Math.min(items.length - 1, pos.t > 0.5 ? pos.index + 1 : pos.index);
    scroll.scrollToItem(index, index === 0 ? 0 : deps.land);
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('focus', () => (focused = true));
  root.addEventListener('blur', () => (focused = false));

  window.addEventListener(
    'pointermove',
    (e) => {
      near = e.pointerType === 'mouse' && e.clientX > window.innerWidth - 96;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => (near = false));

  return {
    isDragging: () => dragging,
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) release();
    },
    /** Redraw the bubble text, e.g. after a language change. */
    refreshText() {
      if (bubbleItem >= 0) showItem(bubbleItem, true);
    },
    update(now: number, progress: number, currentItem: number) {
      if (lastP >= 0 && Math.abs(progress - lastP) > 0.0004) visibleUntil = now + SHOW_FOR;
      lastP = progress;
      const live = enabled && (dragging || focused || now < visibleUntil);
      root.classList.toggle('is-visible', live || (enabled && near));
      root.classList.toggle('is-live', live);
      const top = `${(progress * 100).toFixed(3)}%`;
      handle.style.top = top;
      bubble.style.top = top;
      showItem(dragging ? scroll.locateProgress(dragP).index : currentItem);
      root.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    },
  };
}

export type Scrubber = ReturnType<typeof createScrubber>;
