import { TREATMENTS, type Treatment } from '../lib/constants';
import { PRESETS, WEIGHT_KEYS, type Weights } from './shader/presets';

/**
 * Tuning panel, opened with ?debug in the address. Shows every shader weight
 * as a slider and lets you force any era's treatment onto the current image.
 * While "override" is ticked, the sliders replace the scroll-driven weights.
 */
export function createDebug() {
  const weights: Weights = { ...PRESETS.film };
  let override = false;
  const inputs = new Map<string, HTMLInputElement>();

  const panel = document.createElement('div');
  panel.className = 'debug';
  panel.setAttribute('data-lenis-prevent', '');
  panel.innerHTML = `
    <div class="debug__row debug__row--head">
      <label><input type="checkbox" class="debug__override" /> override</label>
      <select class="debug__preset"></select>
      <span class="debug__fps">-- fps</span>
    </div>
    <div class="debug__sliders"></div>`;

  const select = panel.querySelector<HTMLSelectElement>('.debug__preset')!;
  for (const name of TREATMENTS) select.add(new Option(name, name));
  select.value = 'film';

  const sliders = panel.querySelector<HTMLElement>('.debug__sliders')!;
  for (const key of WEIGHT_KEYS) {
    const row = document.createElement('label');
    row.className = 'debug__row';
    const name = document.createElement('span');
    name.textContent = key;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = String(weights[key]);
    const value = document.createElement('output');
    value.textContent = weights[key].toFixed(2);
    input.addEventListener('input', () => {
      weights[key] = Number(input.value);
      value.textContent = weights[key].toFixed(2);
      setOverride(true);
    });
    row.append(name, input, value);
    sliders.append(row);
    inputs.set(key, input);
  }

  const checkbox = panel.querySelector<HTMLInputElement>('.debug__override')!;
  function setOverride(value: boolean) {
    override = value;
    checkbox.checked = value;
  }
  checkbox.addEventListener('change', () => setOverride(checkbox.checked));

  function load(source: Weights) {
    for (const key of WEIGHT_KEYS) {
      weights[key] = source[key];
      const input = inputs.get(key)!;
      input.value = String(source[key]);
      (input.nextElementSibling as HTMLOutputElement).textContent = source[key].toFixed(2);
    }
  }
  select.addEventListener('change', () => {
    load(PRESETS[select.value as Treatment]);
    setOverride(true);
  });

  document.body.append(panel);

  const fps = panel.querySelector<HTMLElement>('.debug__fps')!;
  let frames = 0;
  let since = performance.now();

  return {
    /** The forced weights, or null to use the scroll-driven ones. */
    weights(): Weights | null {
      return override ? weights : null;
    },
    /** Mirrors the live weights into the sliders while not overriding. */
    show(live: Weights) {
      frames++;
      const now = performance.now();
      if (now - since >= 500) {
        fps.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
        frames = 0;
        since = now;
        if (!override) load(live);
      }
    },
  };
}

export type Debug = ReturnType<typeof createDebug>;
