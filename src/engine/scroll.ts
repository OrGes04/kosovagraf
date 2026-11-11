import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { locate, type Position } from './sequence';

/**
 * Owns scrolling. Lenis gives the weighted, smooth feel; one ScrollTrigger
 * watches the whole track and keeps the measurements fresh on resize. The rest
 * of the engine only ever asks "where are we?" via position().
 */
export function createScroll(track: HTMLElement, sections: HTMLElement[], opts: { smooth: boolean }) {
  gsap.registerPlugin(ScrollTrigger);

  let starts: number[] = [];
  let sizes: number[] = [];
  let y = window.scrollY;
  let locked = false;

  const lenis = opts.smooth ? new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 }) : null;
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function measure() {
    const last = sections.length - 1;
    starts = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
    // The last section is one screen taller, so its progress reaches 1 exactly
    // when the page cannot scroll any further.
    sizes = sections.map((s, i) => (i === last ? s.offsetHeight - window.innerHeight : s.offsetHeight));
  }

  ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    onRefresh: measure,
    onUpdate: (self) => {
      y = self.scroll();
    },
  });
  measure();

  function setLocked(value: boolean) {
    locked = value;
    if (lenis) {
      if (value) lenis.stop();
      else lenis.start();
    }
    document.documentElement.classList.toggle('is-locked', value);
  }

  return {
    position(): Position {
      // Read the live offset: ScrollTrigger's value can lag by a frame.
      y = window.scrollY;
      return locate(starts, sizes, y);
    },
    /** Jump straight to a point inside an item (0 = its start). */
    jumpTo(index: number, t = 0) {
      const target = Math.round(starts[index]! + sizes[index]! * t);
      const wasLocked = locked;
      if (wasLocked) setLocked(false);
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else window.scrollTo(0, target);
      if (wasLocked) setLocked(true);
    },
    setLocked,
    isLocked: () => locked,
    refresh: () => ScrollTrigger.refresh(),
  };
}

export type Scroll = ReturnType<typeof createScroll>;
