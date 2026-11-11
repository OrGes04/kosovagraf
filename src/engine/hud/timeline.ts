import type { UiStrings } from '../../i18n';
import type { Locale } from '../../lib/constants';
import { thumbUrl } from '../renderer/types';
import type { Item } from '../sequence';
import type { EraData, SceneData } from '../types';
import { el, formatYear } from './text';

/** Pixels between two stops on the ruler. */
const UNIT = 220;
const MINOR_TICKS = 10;

/**
 * The sliding ruler. Stops are evenly spaced (one per scene) rather than
 * proportional to years: 3000 years would otherwise squeeze the whole 20th
 * century into a few pixels. Between two stops the small ticks divide the
 * years evenly.
 */
export function createTimeline(
  root: HTMLElement,
  items: Item[],
  scenes: SceneData[],
  eras: EraData[],
  onJump: (itemIndex: number) => void,
) {
  const strip = root.querySelector<HTMLElement>('.timeline__strip')!;
  const preview = root.querySelector<HTMLElement>('.timeline__preview')!;
  const progress = root.querySelector<HTMLElement>('.timeline__progress-fill')!;
  const eraById = new Map(eras.map((e) => [e.id, e]));
  const dots: HTMLButtonElement[] = [];
  const labels: HTMLElement[] = [];
  let lang: Locale = 'sq';
  let strings: UiStrings;
  let activeIndex = -1;
  let lastX = NaN;

  strip.textContent = '';
  strip.style.width = `${(items.length - 1) * UNIT}px`;

  // Era bands: one coloured stretch per run of scenes in the same era.
  let runStart = 0;
  for (let i = 1; i <= items.length; i++) {
    const era = scenes[items[runStart]!.scene]!.era;
    if (i < items.length && scenes[items[i]!.scene]!.era === era) continue;
    const band = el('span', 'timeline__band');
    const data = eraById.get(era)!;
    band.style.left = `${(runStart - 0.5) * UNIT}px`;
    band.style.width = `${(i - runStart) * UNIT}px`;
    band.style.setProperty('--era', data.color);
    band.append(el('span', 'timeline__band-label', data.roman));
    strip.append(band);
    runStart = i;
  }

  items.forEach((_item, i) => {
    if (i < items.length - 1) {
      for (let j = 1; j < MINOR_TICKS; j++) {
        const tick = el('span', 'timeline__tick');
        tick.style.left = `${(i + j / MINOR_TICKS) * UNIT}px`;
        strip.append(tick);
      }
    }
    const major = el('span', 'timeline__tick timeline__tick--major');
    major.style.left = `${i * UNIT}px`;
    strip.append(major);

    const label = el('span', 'timeline__label');
    label.style.left = `${i * UNIT}px`;
    strip.append(label);
    labels.push(label);

    const dot = el('button', 'timeline__dot');
    dot.type = 'button';
    dot.style.left = `${i * UNIT}px`;
    dot.addEventListener('click', () => onJump(i));
    dot.addEventListener('pointerenter', () => showPreview(i, dot));
    dot.addEventListener('focus', () => showPreview(i, dot));
    dot.addEventListener('pointerleave', hidePreview);
    dot.addEventListener('blur', hidePreview);
    strip.append(dot);
    dots.push(dot);
  });

  function sceneOf(i: number): SceneData {
    return scenes[items[i]!.scene]!;
  }

  function titleOf(i: number): string {
    return items[i]!.kind === 'title' ? strings.site.title : sceneOf(i).title[lang];
  }

  function showPreview(i: number, dot: HTMLElement) {
    const scene = sceneOf(i);
    preview.textContent = '';
    const img = el('img', 'timeline__preview-img');
    img.src = thumbUrl(scene);
    img.alt = '';
    img.width = 160;
    img.height = 90;
    preview.append(
      img,
      el('span', 'timeline__preview-year', formatYear(items[i]!.year, strings)),
      el('span', 'timeline__preview-title', titleOf(i)),
    );
    const box = root.getBoundingClientRect();
    const at = dot.getBoundingClientRect();
    preview.style.left = `${at.left + at.width / 2 - box.left}px`;
    preview.classList.add('is-visible');
  }

  function hidePreview() {
    preview.classList.remove('is-visible');
  }

  return {
    setLanguage(next: Locale, ui: UiStrings) {
      lang = next;
      strings = ui;
      items.forEach((item, i) => {
        labels[i]!.textContent = formatYear(item.year, ui);
        dots[i]!.setAttribute('aria-label', `${ui.timeline.jumpTo}: ${titleOf(i)}, ${formatYear(item.year, ui)}`);
      });
    },
    /** u is the ruler coordinate: item index plus the roll towards the next. */
    update(u: number, index: number) {
      const x = Math.round(-u * UNIT * 10) / 10;
      if (x !== lastX) {
        lastX = x;
        strip.style.transform = `translate3d(${x}px, 0, 0)`;
        progress.style.transform = `scaleX(${(u / Math.max(1, items.length - 1)).toFixed(4)})`;
      }
      if (index !== activeIndex) {
        dots[activeIndex]?.classList.remove('is-active');
        dots[activeIndex]?.removeAttribute('aria-current');
        dots[index]?.classList.add('is-active');
        dots[index]?.setAttribute('aria-current', 'step');
        activeIndex = index;
      }
    },
  };
}

export type Timeline = ReturnType<typeof createTimeline>;
