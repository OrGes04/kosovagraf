import { odometer } from '../sequence';
import { el } from './text';

const PLACES = 4;

/**
 * A mechanical year counter. Each digit is a wheel (a column 0-9-0) that is
 * shifted vertically; leading zeros collapse away, and a suffix shows for BC.
 */
export function createOdometer(root: HTMLElement) {
  root.textContent = '';
  root.classList.add('odometer');
  // Screen readers get the chapter and scene text instead of a spinning number.
  root.setAttribute('aria-hidden', 'true');

  const wheels: HTMLElement[] = [];
  const strips: HTMLElement[] = [];
  for (let i = 0; i < PLACES; i++) {
    const wheel = el('span', 'odometer__wheel');
    const strip = el('span', 'odometer__strip');
    for (let d = 0; d <= 10; d++) strip.append(el('span', 'odometer__digit', String(d % 10)));
    wheel.append(strip);
    root.append(wheel);
    wheels.push(wheel);
    strips.push(strip);
  }
  const suffix = el('span', 'odometer__suffix');
  root.append(suffix);

  let lastKey = '';
  let lastSuffix = '';

  return {
    set(value: number, bcLabel: string) {
      const positions = odometer(value, PLACES);
      const abs = Math.abs(value);
      // Avoid touching the DOM when nothing visible changed.
      const key = positions.map((p) => p.toFixed(3)).join(',');
      if (key !== lastKey) {
        lastKey = key;
        positions.forEach((p, i) => {
          strips[i]!.style.transform = `translate3d(0, ${(-p * 100) / 11}%, 0)`;
          // A wheel appears just as the one below starts carrying into it.
          const unit = 10 ** (PLACES - 1 - i);
          wheels[i]!.classList.toggle('is-hidden', unit > 1 && abs < unit - 1);
        });
      }
      const nextSuffix = value < -0.5 ? bcLabel : '';
      if (nextSuffix !== lastSuffix) {
        lastSuffix = nextSuffix;
        suffix.textContent = nextSuffix;
        suffix.classList.toggle('is-visible', nextSuffix !== '');
      }
    },
  };
}

export type Odometer = ReturnType<typeof createOdometer>;
