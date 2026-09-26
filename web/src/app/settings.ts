import { defaultRules } from '../core';
import {
  DEFAULT_KEYMAPS, DEFAULT_PADMAP, DEVICE_IDS, KEY_FIELDS, PAD_FIELDS,
  type DeviceId, type KeyMap, type PadMap,
} from '../input/input';
import { CHARACTERS } from '../render/art/bomber';

export type SlotKind = 'human' | 'cpu' | 'off';

export interface RuleChoices {
  cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number;
  suddenDeath: boolean; badBomber: boolean; racer: boolean;
}

/** Opções gerais (fora das regras da partida): spawn aleatório e volumes. */
export interface Options {
  randomSpawns: boolean; musicVol: number; sfxVol: number;
}

export function defaultOptions(): Options {
  return { randomSpawns: false, musicVol: 8, sfxVol: 8 };
}

/** O que foi escolhido nos menus para a próxima partida (lembrado entre sessões). */
export interface Setup {
  mode: 'ffa' | 'team';
  slots: SlotKind[];
  teams: number[];
  rules: RuleChoices;
  chars: number[];
  stage: number;
}

export interface Settings {
  version: 2;
  names: string[];
  devices: DeviceId[];
  keymaps: KeyMap[];
  padmaps: PadMap[];
  options: Options;
  setup: Setup;
}

export const NAME_MAX = 8;
export const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
export const STORAGE_KEY = 'crown-blast/settings';

export function defaultSetup(): Setup {
  const r = defaultRules();
  return {
    mode: 'ffa', slots: ['human', 'human', 'cpu', 'cpu', 'cpu'], teams: [0, 1, 0, 1, 0],
    rules: {
      cpuLevel: r.cpuLevel, matches: r.matches, timeIdx: r.timeIdx, suddenDeath: r.suddenDeath,
      badBomber: r.badBomber, racer: r.racer,
    },
    chars: [0, 1, 2, 3, 4], stage: 1,
  };
}

export function defaultSettings(): Settings {
  return {
    version: 2, names: ['', '', '', '', ''], devices: ['kb0', 'kb1', 'gp0', 'gp1', 'gp2'],
    keymaps: DEFAULT_KEYMAPS.map(m => ({ ...m })), padmaps: [0, 1, 2, 3].map(() => ({ ...DEFAULT_PADMAP })),
    options: defaultOptions(), setup: defaultSetup(),
  };
}

/** Maiúsculas sem acento, só A–Z, 0–9, espaço e hífen, no máximo NAME_MAX caracteres. */
export function sanitizeName(s: unknown): string {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()) if (NAME_CHARS.includes(ch)) out += ch;
  return out.trim().slice(0, NAME_MAX).trimEnd();
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const oneOf = <T>(v: unknown, allowed: readonly T[], def: T): T => ((allowed as readonly unknown[]).includes(v) ? (v as T) : def);
const intIn = (v: unknown, min: number, max: number, def: number): number =>
  (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : def);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const five = <T>(v: unknown, f: (x: unknown, i: number) => T): T[] => [0, 1, 2, 3, 4].map(i => f(Array.isArray(v) ? v[i] : undefined, i));

function normalizeKeyMap(v: unknown, def: KeyMap): KeyMap {
  const o = asObj(v);
  const m = { ...def };
  for (const f of KEY_FIELDS) {
    const k = o[f];
    if (typeof k === 'string' && k.length > 0 && k.length < 32) m[f] = k;
  }
  return m;
}

function normalizePadMap(v: unknown): PadMap {
  const o = asObj(v);
  const m = { ...DEFAULT_PADMAP };
  for (const f of PAD_FIELDS) {
    const k = o[f];
    if (typeof k === 'number' && Number.isInteger(k) && k >= 0 && k <= 31) m[f] = k;
  }
  return m;
}

/** Aceita qualquer coisa (JSON antigo, corrompido, parcial) e devolve configurações válidas. */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = asObj(raw);
  const s = asObj(r.setup);
  const rr = asObj(s.rules);
  const ro = asObj(r.options);
  const ds = d.setup;
  return {
    version: 2,
    names: five(r.names, x => sanitizeName(x)),
    devices: five(r.devices, (x, i) => oneOf(x, DEVICE_IDS, d.devices[i])),
    keymaps: [0, 1].map(k => normalizeKeyMap(Array.isArray(r.keymaps) ? r.keymaps[k] : undefined, d.keymaps[k])),
    padmaps: [0, 1, 2, 3].map(k => normalizePadMap(Array.isArray(r.padmaps) ? r.padmaps[k] : undefined)),
    options: {
      randomSpawns: bool(ro.randomSpawns, d.options.randomSpawns),
      musicVol: intIn(ro.musicVol, 0, 10, d.options.musicVol),
      sfxVol: intIn(ro.sfxVol, 0, 10, d.options.sfxVol),
    },
    setup: {
      mode: oneOf(s.mode, ['ffa', 'team'] as const, ds.mode),
      slots: five(s.slots, (x, i) => oneOf(x, ['human', 'cpu', 'off'] as const, ds.slots[i])),
      teams: five(s.teams, (x, i) => oneOf(x, [0, 1] as const, ds.teams[i])),
      rules: {
        cpuLevel: oneOf(rr.cpuLevel, [0, 1, 2] as const, ds.rules.cpuLevel),
        matches: intIn(rr.matches, 1, 5, ds.rules.matches),
        timeIdx: intIn(rr.timeIdx, 0, 4, ds.rules.timeIdx),
        suddenDeath: bool(rr.suddenDeath, ds.rules.suddenDeath),
        badBomber: bool(rr.badBomber, ds.rules.badBomber),
        racer: bool(rr.racer, ds.rules.racer),
      },
      chars: five(s.chars, (x, i) => intIn(x, 0, CHARACTERS.length - 1, ds.chars[i])),
      stage: intIn(s.stage, 1, 10, ds.stage),
    },
  };
}

/**
 * Gancho para migrações entre versões do formato salvo. A v1 não tinha `padmaps`/`options` e trazia
 * `randomSpawns` dentro de `setup.rules` (agora em Opções): apaga o campo de lá (o valor antigo é
 * descartado — Opções nasce com o padrão Não) e deixa o resto para `normalizeSettings` completar
 * (teclas novas do teclado, ex. L/R/SELECT, ganham o padrão daquele conjunto).
 */
export function migrate(raw: unknown): unknown {
  const version = asObj(raw).version;
  if (version === undefined || version === 1) {
    const rules = asObj(asObj(raw).setup).rules;
    if (rules && typeof rules === 'object') delete (rules as Obj).randomSpawns;
  }
  return raw;
}

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function loadSettings(st: StorageLike | null): Settings {
  try {
    const raw = st?.getItem(STORAGE_KEY);
    return normalizeSettings(migrate(raw ? JSON.parse(raw) : null));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(st: StorageLike | null, s: Settings): void {
  try {
    st?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // armazenamento indisponível (aba anônima, cota): segue só em memória
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
