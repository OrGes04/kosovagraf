import type { SceneData } from '../types';
import { el } from './text';

/**
 * The mini timeline under the caption: one tick per scene, a gap between
 * chapters, a taller tick where each chapter starts, the current scene lit.
 * Spaced by scene, never by year (a scale of years would squeeze the last
 * thirty years into a few pixels).
 */
export function createMiniTimeline(root: HTMLElement, scenes: SceneData[]) {
  root.textContent = '';
  root.setAttribute('aria-hidden', 'true');

  const ticks = scenes.map((scene, i) => {
    const tick = el('span', 'mini__tick');
    if (i > 0 && scenes[i - 1]!.era !== scene.era) tick.classList.add('is-chapter');
    if (i === 0) tick.classList.add('is-first');
    root.append(tick);
    return tick;
  });
  const chapters = ticks.filter((t) => t.classList.contains('is-chapter')).length;

  function layout() {
    const width = root.clientWidth || 260;
    const spacing = Math.floor((width - chapters * 6) / Math.max(1, ticks.length));
    root.style.setProperty('--sp', `${Math.max(3, Math.min(7, spacing))}px`);
  }
  new ResizeObserver(layout).observe(root);
  layout();

  let current = -2;

  return {
    /** Index into scenes, or -1 for none. */
    set(index: number) {
      if (index === current) return;
      current = index;
      ticks.forEach((tick, i) => {
        tick.classList.toggle('is-past', index >= 0 && i < index);
        tick.classList.toggle('is-current', i === index);
      });
    },
  };
}
