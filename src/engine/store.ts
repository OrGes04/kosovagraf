import { DEFAULT_CHANNEL, type Channel, type Locale } from '../lib/constants';

/** Viewer preferences. Small on purpose: everything else derives from scroll. */
export interface Prefs {
  lang: Locale;
  /** Opt-in. Audio itself arrives in Milestone 2; the choice is already stored. */
  sound: boolean;
  effects: boolean;
  channel: Channel;
}

type Listener<K extends keyof Prefs> = (value: Prefs[K]) => void;

const STORAGE_KEY = 'kosovograf:prefs';

function readSaved(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
  } catch {
    return {};
  }
}

export function createStore(lang: Locale) {
  const saved = readSaved();
  const state: Prefs = {
    lang,
    sound: false, // always starts muted; the opening asks each visit
    effects: saved.effects ?? true,
    channel: DEFAULT_CHANNEL,
  };
  const listeners = new Map<keyof Prefs, Set<(v: never) => void>>();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ effects: state.effects }));
    } catch {
      // Private mode or blocked storage: preferences just do not persist.
    }
  }

  return {
    get<K extends keyof Prefs>(key: K): Prefs[K] {
      return state[key];
    },
    set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
      if (state[key] === value) return;
      state[key] = value;
      save();
      listeners.get(key)?.forEach((fn) => (fn as Listener<K>)(value));
    },
    on<K extends keyof Prefs>(key: K, fn: Listener<K>) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(fn as (v: never) => void);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
