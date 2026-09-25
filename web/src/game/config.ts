import { defaultRules, type Rules } from '../core';
import { CHARACTERS } from '../render/art/bomber';

export interface GameConfig { rules: Rules; stage: number; chars: number[]; seed: number | null }

function int(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/**
 * Regras a partir da URL (até o Plano 3 trazer os menus):
 * ?stage=1..10&players=2..5&matches=1..5&time=0..4&mode=ffa|team&sd=1&racer=1&spawns=0&chars=0,1,2,3,4&seed=N
 */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const rules: Rules = {
    ...defaultRules(),
    matches: int(q.get('matches'), 3, 1, 5),
    timeIdx: int(q.get('time'), 2, 0, 4),
    suddenDeath: q.get('sd') === '1',
    racer: q.get('racer') === '1',
    randomSpawns: q.get('spawns') !== '0',
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    teams: [0, 1, 0, 1, 0],
    active: [0, 1, 2, 3, 4].map(i => i < players),
  };
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const chars = [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] < CHARACTERS.length ? raw[i] : i));
  return { rules, stage: int(q.get('stage'), 1, 1, 10), chars, seed: q.has('seed') ? int(q.get('seed'), 0, 0, 2 ** 31 - 1) : null };
}
