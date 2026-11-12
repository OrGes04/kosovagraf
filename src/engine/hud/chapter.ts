import gsap from 'gsap';
import type { UiStrings } from '../../i18n';
import type { Locale } from '../../lib/constants';
import type { EraData } from '../types';
import { createOdometer } from './odometer';

/**
 * The chapter change: the screen dims a little, the year rolls in very large
 * with the chapter numeral and name, then everything fades back to the story.
 */
export function createChapterCard(root: HTMLElement, opts: { reducedMotion: boolean }) {
  const inner = root.querySelector<HTMLElement>('.chapter-card__inner')!;
  const numberEl = root.querySelector<HTMLElement>('.chapter-card__number')!;
  const nameEl = root.querySelector<HTMLElement>('.chapter-card__name')!;
  const odo = createOdometer(root.querySelector<HTMLElement>('.chapter-card__year')!);
  let timeline: gsap.core.Timeline | null = null;

  function hide() {
    timeline?.kill();
    timeline = null;
    root.hidden = true;
  }

  return {
    show(era: EraData, year: number, fromYear: number, ui: UiStrings, lang: Locale) {
      timeline?.kill();
      numberEl.textContent = era.roman;
      nameEl.textContent = era.title[lang];
      root.hidden = false;
      const bc = ui.timeline.bc;
      const value = { y: opts.reducedMotion ? year : fromYear };
      odo.set(value.y, bc);

      timeline = gsap.timeline({ onComplete: hide });
      if (opts.reducedMotion) {
        timeline.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.4 });
        timeline.to(root, { opacity: 0, duration: 0.6 }, '+=1.6');
        return;
      }
      timeline.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
      timeline.fromTo(inner, { y: 22 }, { y: 0, duration: 0.9, ease: 'power3.out' }, 0);
      timeline.to(
        value,
        { y: year, duration: 1.05, ease: 'power2.inOut', onUpdate: () => odo.set(value.y, bc) },
        0.1,
      );
      timeline.to(root, { opacity: 0, duration: 0.7, ease: 'power2.in' }, '+=0.9');
    },
    hide,
  };
}

export type ChapterCard = ReturnType<typeof createChapterCard>;
