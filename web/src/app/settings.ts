import { defaultRules } from '../game/core-api';
import { STAGE_MAX } from '../game/stages';
import {
  DEFAULT_KEYMAPS, DEFAULT_PADMAP, DEVICE_IDS, KEY_FIELDS, PAD_FIELDS,
  type DeviceId, type KeyMap, type PadMap,
} from '../input/input';
import { SCREEN_KINDS, type ScreenKind } from '../render/display';
import { CHARACTERS } from '../render/art/bomber';

export type SlotKind = 'human' | 'cpu' | 'off';

export interface RuleChoices {
  cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number;
  suddenDeath: boolean; badBomber: boolean; racer: boolean;
}

/** Opções gerais (fora das regras da partida): spawn aleatório (padrão SIM) e volumes. */
export interface Options {
  randomSpawns: boolean; musicVol: number; sfxVol: number;
  gloveEscape: number;   // apertos de B para se soltar da luva (1..30)
  throwStun: boolean;    // só jogador arremessado sobre outro jogador atordoa os dois (bomba atordoa sempre)
  sleepSec: number;      // duração do soneca (montaria F), segundos (1..10); a ROM usa 3,2 s
  fx: boolean;           // efeitos visuais da batalha (luz, partículas, sombras…)
  allMounts: boolean;    // MONTARIAS EXTRAS: ovos dos 13 tipos (senha 0164 do original); padrão SIM
  screen: ScreenKind;    // 'hd' (padrão): altura toda em 4:3 + laterais borradas; 'classic': inteiros, pixel 8:7, bordas pretas
  smooth: boolean;       // filtro suave (pixel art ampliada com bordas lisas); padrão NÃO (nítido)
}

export function defaultOptions(): Options {
  return { randomSpawns: true, musicVol: 8, sfxVol: 8, gloveEscape: 10, throwStun: false, sleepSec: 3, fx: true, allMounts: true, screen: 'hd', smooth: false };
}

/** Slots de Opções → Controles: dispositivo, teclas e botões dos 5 jogadores. */
export interface ControlPreset { devices: DeviceId[]; keymaps: KeyMap[]; padmaps: PadMap[] }
/** Slots de Opções → Jogabilidade. */
export type GameplayPreset = Pick<Options, 'randomSpawns' | 'gloveEscape' | 'throwStun' | 'sleepSec'>;
export const SLOT_COUNT = 3;

/** DEV CONTROLES (Opções → Controles, depois do slot 3; fixo): três jogadores no teclado (a config "3 teclados" do
 *  emulador) e P4/P5 nos controles 2 e 1. P1 com as teclas de poder próprias (J bomba, H dancinha, G soco, Y para a
 *  bomba, T poder do P); P2 com o poder do P no Num7; P3 com o P no Delete. */
export function devControls(): ControlPreset {
  const none = { l: '', r: '' };
  return {
    devices: ['kb', 'kb', 'kb', 'gp1', 'gp0'],
    keymaps: [
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyH', y: 'KeyG', x: 'KeyY', power: 'KeyT',
        start: 'Digit2', select: 'Digit1', ...none },
      { up: 'KeyO', down: 'KeyL', left: 'KeyK', right: 'Semicolon', a: 'Numpad6', b: 'Numpad5', y: 'Numpad4', x: 'Numpad8', power: 'Numpad7',
        start: 'NumpadMultiply', select: 'NumpadDivide', ...none },
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ControlRight', y: 'Backspace', x: 'ShiftRight',
        power: 'Delete', start: '', select: '', ...none },
      { ...DEFAULT_KEYMAPS[3] }, { ...DEFAULT_KEYMAPS[4] },
    ],
    padmaps: [0, 1, 2, 3, 4].map(() => ({ ...DEFAULT_PADMAP })),
  };
}

export function gameplayOf(o: Options): GameplayPreset {
  return { randomSpawns: o.randomSpawns, gloveEscape: o.gloveEscape, throwStun: o.throwStun, sleepSec: o.sleepSec };
}
export function controlsOf(s: Pick<Settings, 'devices' | 'keymaps' | 'padmaps'>): ControlPreset {
  return { devices: [...s.devices], keymaps: s.keymaps.map(m => ({ ...m })), padmaps: s.padmaps.map(m => ({ ...m })) };
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
  version: 4;
  names: string[];
  devices: DeviceId[];
  /** Teclas e botões de controle de cada jogador (5 cada), usados conforme o dispositivo escolhido. */
  keymaps: KeyMap[];
  padmaps: PadMap[];
  options: Options;
  setup: Setup;
  /** Slots salvos (null = vazio). Jogabilidade: o 1 nasce com o padrão do jogo. "Restaurar padrão" não mexe nisto. */
  controlSlots: (ControlPreset | null)[];
  gameplaySlots: (GameplayPreset | null)[];
  /** Controle da sala online: um perfil só dele (dispositivo, teclas e botões), separado dos 5 jogadores locais. */
  online: OnlineControls;
}

export interface OnlineControls { device: DeviceId; keymap: KeyMap; padmap: PadMap }
export const defaultOnlineControls = (): OnlineControls => ({ device: 'kb', keymap: { ...DEFAULT_KEYMAPS[0] }, padmap: { ...DEFAULT_PADMAP } });

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
    version: 4, names: ['', '', '', '', ''], ...devControls(),   // começa com o DEV CONTROLES carregado
    options: defaultOptions(), setup: defaultSetup(),
    controlSlots: [null, null, null], gameplaySlots: [gameplayOf(defaultOptions()), null, null],
    online: defaultOnlineControls(),
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
    if (typeof k === 'string' && k.length < 32) m[f] = k;
  }
  return m;
}

function normalizePadMap(v: unknown): PadMap {
  const o = asObj(v);
  const m = { ...DEFAULT_PADMAP };
  for (const f of PAD_FIELDS) {
    const k = o[f];
    if (typeof k === 'number' && Number.isInteger(k) && k >= (f === 'power' ? -1 : 0) && k <= 31) m[f] = k;
  }
  return m;
}

const slots = <T>(v: unknown, def: readonly (T | null)[], f: (x: unknown) => T): (T | null)[] =>
  Array.from({ length: SLOT_COUNT }, (_, i) => {
    if (!Array.isArray(v)) return def[i] ?? null;
    return v[i] && typeof v[i] === 'object' ? f(v[i]) : null;
  });

function normalizeControlPreset(v: unknown, d: Settings): ControlPreset {
  const o = asObj(v);
  return {
    devices: five(o.devices, (x, i) => oneOf(x, DEVICE_IDS, d.devices[i])),
    keymaps: five(o.keymaps, (x, i) => normalizeKeyMap(x, d.keymaps[i])),
    padmaps: five(o.padmaps, x => normalizePadMap(x)),
  };
}

function normalizeGameplayPreset(v: unknown, d: Options): GameplayPreset {
  const o = asObj(v);
  return {
    randomSpawns: bool(o.randomSpawns, d.randomSpawns),
    gloveEscape: intIn(o.gloveEscape, 1, 30, d.gloveEscape),
    throwStun: bool(o.throwStun, d.throwStun),
    sleepSec: intIn(o.sleepSec, 1, 10, d.sleepSec),
  };
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
    version: 4,
    names: five(r.names, x => sanitizeName(x)),
    devices: five(r.devices, (x, i) => oneOf(x, DEVICE_IDS, d.devices[i])),
    keymaps: five(r.keymaps, (x, i) => normalizeKeyMap(x, d.keymaps[i])),
    padmaps: five(r.padmaps, x => normalizePadMap(x)),
    options: {
      randomSpawns: bool(ro.randomSpawns, d.options.randomSpawns),
      musicVol: intIn(ro.musicVol, 0, 10, d.options.musicVol),
      sfxVol: intIn(ro.sfxVol, 0, 10, d.options.sfxVol),
      gloveEscape: intIn(ro.gloveEscape, 1, 30, d.options.gloveEscape),
      throwStun: bool(ro.throwStun, d.options.throwStun),
      sleepSec: intIn(ro.sleepSec, 1, 10, d.options.sleepSec),
      fx: bool(ro.fx, d.options.fx),
      allMounts: bool(ro.allMounts, d.options.allMounts),
      screen: oneOf(ro.screen, SCREEN_KINDS, d.options.screen),
      smooth: bool(ro.smooth, d.options.smooth),
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
      stage: intIn(s.stage, 1, STAGE_MAX, ds.stage),
    },
    controlSlots: slots(r.controlSlots, d.controlSlots, x => normalizeControlPreset(x, d)),
    gameplaySlots: slots(r.gameplaySlots, d.gameplaySlots, x => normalizeGameplayPreset(x, d.options)),
    online: {
      device: oneOf(asObj(r.online).device, DEVICE_IDS, d.online.device),
      keymap: normalizeKeyMap(asObj(r.online).keymap, d.online.keymap),
      padmap: normalizePadMap(asObj(r.online).padmap),
    },
  };
}

/**
 * Gancho para migrações entre versões do formato salvo. A v1 não tinha `padmaps`/`options` e trazia
 * `randomSpawns` dentro de `setup.rules` (agora em Opções): apaga o campo de lá (o valor antigo é
 * descartado — Opções nasce com o padrão Não) e deixa o resto para `normalizeSettings` completar.
 * Até a v2 os mapas eram por dispositivo (Teclado 1/2, Controles 1–4); na v3 são por jogador: cada jogador herda
 * o mapa do dispositivo que usava (teclas novas, ex. L/R/SELECT, ganham o padrão daquele teclado). Na v4 os spawns
 * aleatórios vêm ligados e o PODER (P) do controle vai para o RB (só onde o P ainda não tinha botão e o R estava no RB).
 */
export function migrate(raw: unknown): unknown {
  const version = asObj(raw).version;
  if (version === undefined || version === 1) {
    const rules = asObj(asObj(raw).setup).rules;
    if (rules && typeof rules === 'object') delete (rules as Obj).randomSpawns;
  }
  if ((version === undefined || version === 1 || version === 2) && raw && typeof raw === 'object') {
    const o = raw as Obj;
    const devs: unknown[] = Array.isArray(o.devices) ? o.devices : ['kb0', 'kb1', 'gp0', 'gp1', 'gp2'];
    const oldK: unknown[] = Array.isArray(o.keymaps) ? o.keymaps : [];
    const oldP: unknown[] = Array.isArray(o.padmaps) ? o.padmaps : [];
    const kb = (d: unknown): number => (d === 'kb0' ? 0 : d === 'kb1' ? 1 : -1);
    const gp = (d: unknown): number => (typeof d === 'string' && /^gp[0-3]$/.test(d) ? Number(d[2]) : -1);
    o.keymaps = [0, 1, 2, 3, 4].map(i => { const k = kb(devs[i]); return k < 0 ? undefined : { ...DEFAULT_KEYMAPS[k], ...asObj(oldK[k]) }; });
    o.padmaps = [0, 1, 2, 3, 4].map(i => { const g = gp(devs[i]); return g < 0 ? undefined : oldP[g]; });
    o.devices = devs.map(d => (kb(d) >= 0 ? 'kb' : d));
  }
  if ((version === undefined || version === 1 || version === 2 || version === 3) && raw && typeof raw === 'object') {
    // v4: spawns aleatórios passam a vir ligados, e o controle ganha o PODER (P) no RB (o R vai para o RT)
    const o = raw as Obj;
    if (o.options && typeof o.options === 'object') (o.options as Obj).randomSpawns = true;
    const rb = (m: unknown): void => {
      const p = asObj(m);
      const busy = (b: number) => Object.entries(p).some(([k, v]) => k !== 'r' && k !== 'power' && v === b);   // RB/RT já em outra ação
      if (m && typeof m === 'object' && (p.power === undefined || p.power === -1) && (p.r === undefined || p.r === 5) && !busy(5) && !busy(7)) {
        p.power = 5; p.r = 7;
      }
    };
    if (Array.isArray(o.padmaps)) o.padmaps.forEach(rb);
    rb(asObj(o.online).padmap);
  }
  return raw;
}

/** Dá o dispositivo `d` ao jogador `i` (M4): um controle nunca fica com dois jogadores — quem estava com ele fica
 *  com o dispositivo antigo de `i`. Teclado e "nenhum" podem repetir (cada jogador no teclado tem suas teclas). */
export function setDevice(devices: DeviceId[], i: number, d: DeviceId): void {
  const j = d === 'kb' || d === 'none' ? -1 : devices.findIndex((x, k) => k !== i && x === d);
  if (j >= 0) devices[j] = devices[i];
  devices[i] = d;
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
