import type { UiStrings } from '../../i18n';
import type { Locale } from '../../lib/constants';
import { thumbUrl } from '../renderer/types';
import type { Scroll } from '../scroll';
import type { Item } from '../sequence';
import type { EraData, SceneData } from '../types';
import { el, formatSceneYear } from './text';

/**
 * The overview: every scene at once, one row per chapter, the current scene
 * outlined. Pick one to go there.
 */
export function createOverview(
  root: HTMLElement,
  deps: {
    scroll: Scroll;
    items: Item[];
    scenes: SceneData[];
    eras: EraData[];
    ui: () => UiStrings;
    lang: () => Locale;
    onPick: (itemIndex: number) => void;
    onToggle: (open: boolean) => void;
  },
) {
  const { items, scenes } = deps;
  const body = root.querySelector<HTMLElement>('.overview__body')!;
  const count = root.querySelector<HTMLElement>('.overview__count')!;
  const close = root.querySelector<HTMLButtonElement>('.overview__close')!;
  let open = false;
  let current = -1;
  let returnFocus: HTMLElement | null = null;

  function build() {
    const ui = deps.ui();
    const lang = deps.lang();
    body.textContent = '';
    let chapters = 0;
    for (const era of deps.eras) {
      const members = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.kind === 'scene' && scenes[item.scene]!.era === era.id);
      if (members.length === 0) continue;
      chapters++;

      const row = el('section', 'overview__row');
      const head = el('div', 'overview__head');
      head.append(el('span', 'overview__roman', era.roman), el('span', 'overview__name', era.title[lang]));
      if (era.years) head.append(el('span', 'overview__years', era.years));
      const strip = el('div', 'overview__strip');

      for (const { item, index } of members) {
        const scene = scenes[item.scene]!;
        const year = formatSceneYear(scene, ui);
        const button = el('button', 'overview__scene');
        button.type = 'button';
        button.dataset.index = String(index);
        button.setAttribute('aria-label', `${ui.timeline.jumpTo}: ${year}, ${scene.title[lang]}`);
        const img = el('img', 'overview__img');
        img.src = thumbUrl(scene);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 320;
        img.height = Math.round((320 * scene.media.height) / scene.media.width);
        const tip = el('span', 'overview__tip');
        tip.append(el('span', 'overview__tip-year', year), el('span', 'overview__tip-title', scene.title[lang]));
        button.append(img, tip);
        button.addEventListener('click', () => {
          setOpen(false);
          deps.onPick(index);
        });
        strip.append(button);
      }
      row.append(head, strip);
      body.append(row);
    }
    count.textContent = `${scenes.length} ${ui.overview.scenes} · ${chapters} ${ui.overview.chapters}`;
    mark();
  }

  function mark() {
    body.querySelectorAll<HTMLElement>('.overview__scene').forEach((button) => {
      const isCurrent = Number(button.dataset.index) === current;
      button.classList.toggle('is-current', isCurrent);
      if (isCurrent) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function setOpen(value: boolean, currentItem?: number) {
    if (value === open) return;
    open = value;
    deps.onToggle(open);
    if (open) {
      if (currentItem !== undefined) {
        current = currentItem;
        mark();
      }
      returnFocus = document.activeElement as HTMLElement | null;
      root.hidden = false;
      deps.scroll.setLocked(true);
      requestAnimationFrame(() => {
        root.classList.add('is-open');
        body.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
        close.focus({ preventScroll: true });
      });
    } else {
      root.classList.remove('is-open');
      deps.scroll.setLocked(false);
      window.setTimeout(() => {
        if (!open) root.hidden = true;
      }, 350);
      returnFocus?.focus?.({ preventScroll: true });
    }
  }

  close.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  });

  build();

  return {
    toggle: (currentItem: number) => setOpen(!open, currentItem),
    close: () => setOpen(false),
    isOpen: () => open,
    rebuild: build,
  };
}

export type Overview = ReturnType<typeof createOverview>;
