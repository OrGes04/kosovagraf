import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

/**
 * Film-style captions. One caption shows at a time; when it changes, the old
 * one fades and the new one rises in line by line.
 */
export function createCaptions(root: HTMLElement, opts: { reducedMotion: boolean }) {
  gsap.registerPlugin(SplitText);
  const line = root.querySelector<HTMLElement>('.captions__text')!;
  let shown = '';
  let split: SplitText | null = null;
  let tween: gsap.core.Animation | null = null;

  function clear() {
    tween?.kill();
    tween = null;
    split?.revert();
    split = null;
  }

  function show(text: string) {
    clear();
    line.textContent = text;
    gsap.set(line, { opacity: 1 });
    if (opts.reducedMotion) {
      tween = gsap.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.4 });
      return;
    }
    // autoSplit re-splits when fonts load or the width changes, so lines stay true.
    split = SplitText.create(line, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'captions__line',
      autoSplit: true,
      onSplit(self) {
        tween = gsap.from(self.lines, {
          yPercent: 110,
          duration: 0.7,
          stagger: 0.14,
          ease: 'power3.out',
        });
        return tween;
      },
    });
  }

  return {
    /** Pass '' to show nothing. */
    set(text: string) {
      if (text === shown) return;
      shown = text;
      if (!text) {
        tween?.kill();
        tween = gsap.to(line, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => {
            clear();
            line.textContent = '';
          },
        });
        return;
      }
      if (!line.textContent) {
        show(text);
        return;
      }
      tween?.kill();
      tween = gsap.to(line, { opacity: 0, duration: 0.18, onComplete: () => show(text) });
    },
  };
}

export type Captions = ReturnType<typeof createCaptions>;
