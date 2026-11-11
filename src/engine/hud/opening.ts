import gsap from 'gsap';
import { TITLE_YEAR } from '../../lib/constants';
import type { Scroll } from '../scroll';
import { createOdometer } from './odometer';

/** Whole-screen states the opening drives; the render loop reads these. */
export interface Overlay {
  staticAmount: number;
  black: number;
}

const START_YEAR = new Date().getFullYear();

/**
 * The opening: static and a sound prompt, then the year counter rolls back
 * from today to 1000 BC and the static clears into the first image.
 */
export function createOpening(
  root: HTMLElement,
  stage: HTMLElement,
  deps: {
    scroll: Scroll;
    overlay: Overlay;
    reducedMotion: boolean;
    bcLabel: () => string;
    onSoundChoice: (sound: boolean) => void;
  },
) {
  const prompt = root.querySelector<HTMLElement>('.opening__prompt')!;
  const counter = root.querySelector<HTMLElement>('.opening__counter')!;
  const skip = root.querySelector<HTMLButtonElement>('.opening__skip')!;
  const odo = createOdometer(root.querySelector<HTMLElement>('.opening__year')!);
  const { scroll, overlay, reducedMotion } = deps;
  let timeline: gsap.core.Timeline | null = null;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    timeline?.kill();
    overlay.staticAmount = 0;
    overlay.black = 0;
    root.hidden = true;
    stage.classList.remove('is-opening');
    scroll.setLocked(false);
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') finish();
  }

  function run() {
    const year = { value: START_YEAR };
    odo.set(year.value, deps.bcLabel());
    timeline = gsap.timeline({ onComplete: finish });
    timeline.to(prompt, { opacity: 0, duration: 0.35, onComplete: () => (prompt.hidden = true) });
    timeline.set(counter, { visibility: 'visible' });
    timeline.fromTo(counter, { opacity: 0 }, { opacity: 1, duration: 0.4 });

    if (reducedMotion) {
      // No rolling numbers: state the destination, then fade the picture in.
      timeline.call(() => odo.set(TITLE_YEAR, deps.bcLabel()));
      timeline.to(overlay, { staticAmount: 0, duration: 0.8, ease: 'none' }, '+=0.6');
      timeline.to(counter, { opacity: 0, duration: 0.4 }, '<');
      return;
    }

    timeline.to(year, {
      value: TITLE_YEAR,
      duration: 4.6,
      ease: 'power3.in', // starts slowly, then the centuries fly past
      onUpdate: () => odo.set(year.value, deps.bcLabel()),
    });
    timeline.to(overlay, { staticAmount: 0, duration: 1.6, ease: 'power2.out' }, '+=0.25');
    timeline.to(counter, { opacity: 0, scale: 0.92, duration: 0.9, ease: 'power2.in' }, '<0.2');
  }

  root.querySelectorAll<HTMLButtonElement>('[data-sound]').forEach((button) => {
    button.addEventListener('click', () => {
      deps.onSoundChoice(button.dataset.sound === 'on');
      run();
    });
  });
  skip.addEventListener('click', finish);

  return {
    start() {
      root.hidden = false;
      stage.classList.add('is-opening');
      overlay.staticAmount = 1;
      scroll.setLocked(true);
      document.addEventListener('keydown', onKey);
      gsap.fromTo(prompt, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3 });
    },
    isDone: () => done,
  };
}
