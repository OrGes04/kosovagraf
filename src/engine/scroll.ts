import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { clamp01, locate, type Position } from './sequence';

/**
 * Owns scrolling. Lenis gives the weighted, smooth feel; one ScrollTrigger
 * watches the whole track and keeps the measurements fresh on resize. The rest
 * of the engine asks "where are we?" via position() and moves with jumpTo(),
 * scrollToItem() and seek().
 */
export function createScroll(track: HTMLElement, sections: HTMLElement[], opts: { smooth: boolean }) {
  gsap.registerPlugin(ScrollTrigger);

  let starts: number[] = [];
  let sizes: number[] = [];
  let max = 1;
  let locked = false;
  const measureListeners = new Set<() => void>();

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
    max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    measureListeners.forEach((fn) => fn());
  }

  ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', onRefresh: measure });
  measure();

  function offsetOf(index: number, t: number): number {
    return Math.round(starts[index]! + sizes[index]! * t);
  }

  /** Runs fn with scrolling briefly allowed, for moves the engine makes itself. */
  function unlocked(fn: () => void) {
    const wasLocked = locked;
    if (wasLocked) setLocked(false);
    fn();
    if (wasLocked) setLocked(true);
  }

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
      return locate(starts, sizes, window.scrollY);
    },
    /** Whole-page progress, 0 at the top and 1 at the end. */
    progress(): number {
      return clamp01(window.scrollY / max);
    },
    /** Page progress at a point inside an item. */
    progressOf(index: number, t = 0): number {
      return clamp01(offsetOf(index, t) / max);
    },
    /** The item and progress at a page progress. */
    locateProgress(p: number): Position {
      return locate(starts, sizes, clamp01(p) * max);
    },
    /** Jump straight to a point inside an item. */
    jumpTo(index: number, t = 0) {
      const target = offsetOf(index, t);
      unlocked(() => {
        if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
        else window.scrollTo(0, target);
      });
    },
    /** Glide to a point inside an item. */
    scrollToItem(index: number, t = 0) {
      if (locked) return;
      const target = offsetOf(index, t);
      if (lenis) lenis.scrollTo(target, { duration: 1.1, easing: (x) => 1 - Math.pow(1 - x, 3) });
      else window.scrollTo({ top: target, behavior: 'auto' });
    },
    /** Follow a scrubber: move to a page progress at once. */
    seek(p: number) {
      if (locked) return;
      const target = Math.round(clamp01(p) * max);
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else window.scrollTo(0, target);
    },
    onMeasure(fn: () => void) {
      measureListeners.add(fn);
    },
    setLocked,
    isLocked: () => locked,
    refresh: () => ScrollTrigger.refresh(),
  };
}

export type Scroll = ReturnType<typeof createScroll>;
