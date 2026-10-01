import { defaultRules, type Rules } from './core-api';
import type { DeviceId } from '../input/input';

export type SlotKind = 'human' | 'cpu' | 'off';
/** Formato estrutural de `Setup` (app/settings.ts), para não depender da ordem de merge. */
export interface SetupLike {
  mode: 'ffa' | 'team'; slots: readonly SlotKind[]; teams: readonly number[];
  rules: { cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number; suddenDeath: boolean; badBomber: boolean; racer: boolean };
  chars: readonly number[]; stage: number;
}
export interface GameConfig {
  rules: Rules; stage: number; chars: number[]; humans: boolean[]; devices: DeviceId[]; seed: number | null;
}
const DEFAULT_DEVICES: DeviceId[] = ['kb', 'kb', 'gp0', 'gp1', 'gp2'];

export const activeCount = (slots: readonly SlotKind[]): number => slots.filter(k => k !== 'off').length;
export const canStart = (slots: readonly SlotKind[]): boolean => activeCount(slots) >= 2;

/** Regras extras que vêm das Opções (não do menu de regras). */
export type ExtraRules = Partial<Pick<Rules, 'gloveEscape' | 'throwStun' | 'sleepTicks' | 'allMounts'>>;

export function configFromSetup(setup: SetupLike, randomSpawns: boolean, devices: readonly DeviceId[], seed: number | null = null,
  extras: ExtraRules = {}): GameConfig {
  const r = setup.rules;
  const rules: Rules = {
    ...defaultRules(), cpuLevel: r.cpuLevel, matches: r.matches, timeIdx: r.timeIdx, suddenDeath: r.suddenDeath,
    badBomber: r.badBomber, racer: r.racer, randomSpawns, ...extras, mode: setup.mode, teams: [...setup.teams],
    active: setup.slots.map(k => k !== 'off'),
  };
  return { rules, stage: setup.stage, chars: [...setup.chars], humans: setup.slots.map(k => k === 'human'),
    devices: [...devices], seed };
}

const int = (v: string | null, def: number, min: number, max: number): number => {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
/** Partida rápida pela URL (?quick): stage, players, matches, time, level, mode, sd, bad, racer, spawns, chars, seed, humans. */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const humansN = int(q.get('humans'), 5, 0, 5);
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const setup: SetupLike = {
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    slots: [0, 1, 2, 3, 4].map(i => (i >= players ? 'off' : i < humansN ? 'human' : 'cpu')),
    teams: [0, 1, 0, 1, 0],
    rules: { cpuLevel: int(q.get('level'), 1, 0, 2) as 0 | 1 | 2, matches: int(q.get('matches'), 3, 1, 5), timeIdx: int(q.get('time'), 2, 0, 4),
      suddenDeath: q.get('sd') === '1', badBomber: q.get('bad') === '1', racer: q.get('racer') === '1' },
    chars: [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] <= 5 ? raw[i] : i)),
    stage: int(q.get('stage'), 1, 1, 10),
  };
  return configFromSetup(setup, q.get('spawns') === '1', DEFAULT_DEVICES, q.has('seed') ? int(q.get('seed'), 0, 0, 0xffff) : null);
}
