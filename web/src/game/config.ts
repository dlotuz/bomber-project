import { defaultRules, type Rules } from '../legacy-core';
import { CHARACTERS } from '../render/art/bomber';
import type { Setup, SlotKind } from '../app/settings';

export interface GameConfig {
  rules: Rules; stage: number; chars: number[]; seed: number | null;
  humans: boolean[];   // slots controlados por gente (CPU = false)
  names: string[];     // nomes dos jogadores ('' = usar P1..P5)
}

function int(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Nome para exibir: o nome configurado ou P1..P5. */
export function displayName(names: readonly string[], slot: number): string {
  const n = names[slot]?.trim();
  return n ? n : `P${slot + 1}`;
}

/**
 * Partida rápida pela URL (usada com ?quick e pelas screenshots):
 * ?stage=1..10&players=2..5&matches=1..5&time=0..4&mode=ffa|team&sd=1&racer=1&spawns=0&chars=0,1,2,3,4&seed=N
 *  &humans=0..5 (quantos dos primeiros jogadores são humanos; o resto é CPU — padrão: todos)
 *  &level=0..2 (nível da CPU: fraco, normal, forte — padrão: normal)
 */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const active = [0, 1, 2, 3, 4].map(i => i < players);
  const rules: Rules = {
    ...defaultRules(),
    matches: int(q.get('matches'), 3, 1, 5),
    timeIdx: int(q.get('time'), 2, 0, 4),
    cpuLevel: int(q.get('level'), 1, 0, 2) as 0 | 1 | 2,
    suddenDeath: q.get('sd') === '1',
    racer: q.get('racer') === '1',
    randomSpawns: q.get('spawns') !== '0',
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    teams: [0, 1, 0, 1, 0],
    active,
  };
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const chars = [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] < CHARACTERS.length ? raw[i] : i));
  return {
    rules, stage: int(q.get('stage'), 1, 1, 10), chars,
    seed: q.has('seed') ? int(q.get('seed'), 0, 0, 2 ** 31 - 1) : null,
    humans: active.map((a, i) => a && i < int(q.get('humans'), 5, 0, 5)), names: ['', '', '', '', ''],
  };
}

/** Regras da partida a partir das escolhas dos menus. */
export function configFromSetup(setup: Setup, names: readonly string[], seed: number | null = null): GameConfig {
  const rules: Rules = {
    ...defaultRules(), ...setup.rules,
    mode: setup.mode, teams: [...setup.teams], active: setup.slots.map(k => k !== 'off'),
  };
  return {
    rules, stage: setup.stage, chars: [...setup.chars], seed,
    humans: setup.slots.map(k => k === 'human'), names: [...names],
  };
}

/** Mensagem de erro se a formação não permite jogar; null se está tudo certo. */
export function validateSetup(mode: 'ffa' | 'team', slots: readonly SlotKind[], teams: readonly number[]): string | null {
  const on = [0, 1, 2, 3, 4].filter(i => slots[i] !== 'off');
  if (on.length < 2) return 'PRECISA DE 2 JOGADORES';
  if (mode === 'team' && new Set(on.map(i => teams[i])).size < 2) return 'CADA TIME PRECISA DE 1 JOGADOR';
  return null;
}
