import type { Rng } from './rng';

export const CELL = { EMPTY: 0, HARD: 1, SOFT: 2 } as const;
export const ITEM = { NONE: 0, BOMB: 1, FIRE: 2, SPEED: 3, KICK: 4, SKULL: 5, PUNCH: 6, GLOVE: 7, PIERCE: 8 } as const;
export const DISEASE = { NONE: 0, SLOW: 1, FAST: 2, DIARRHEA: 3, LOW_FIRE: 4 } as const;
export const DIR = { NONE: 0, UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4 } as const;
export const DX = [0, 0, 0, -1, 1];
export const DY = [0, -1, 1, 0, 0];
export const BTN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128 } as const;

export interface Rules {
  cpuLevel: 0 | 1 | 2;
  matches: number;          // 1..5
  timeIdx: number;          // índice em TIME_OPTIONS_FRAMES
  suddenDeath: boolean;
  badBomber: boolean;
  racer: boolean;
  randomSpawns: boolean;
  mode: 'ffa' | 'team';
  teams: number[];          // time de cada slot (0/1)
  active: boolean[];        // slot participa?
}

export interface Player {
  slot: number; active: boolean; team: number;
  x: number; y: number; facing: number;
  speed: number; maxBombs: number; fire: number;
  kick: boolean; punch: boolean; glove: boolean; pierce: boolean;
  disease: number; diseaseTimer: number;
  alive: boolean; dying: number;
  prevButtons: number; carrying: number; // id da bomba carregada ou -1
}

export interface Flight { dx: number; dy: number; cellsLeft: number; progress: number }

export interface Bomb {
  id: number; owner: number; x: number; y: number;
  fuse: number; range: number; pierce: boolean;
  passers: number[];        // slots que ainda podem atravessar
  slide: number;            // DIR do chute ou NONE
  flight: Flight | null;
  carried: boolean;
}

export interface Arena {
  cells: number[]; items: number[]; hidden: number[];
  flame: number[]; burning: number[];
}

export interface Pressure { order: number[]; next: number; timer: number; overtime: boolean }

export type Phase = 'intro' | 'playing' | 'result';

export interface RoundState {
  rng: Rng; frame: number; phase: Phase; introLeft: number;
  timeLeft: number;         // frames; -1 = infinito
  stage: number; rules: Rules;
  players: Player[]; bombs: Bomb[]; nextBombId: number;
  arena: Arena; pressure: Pressure; winners: number[];
}

export type GameEvent =
  | { type: 'bomb_placed'; slot: number; gx: number; gy: number }
  | { type: 'explosion'; gx: number; gy: number }
  | { type: 'block_destroyed'; gx: number; gy: number }
  | { type: 'player_hit'; slot: number }
  | { type: 'player_out'; slot: number }
  | { type: 'item_picked'; slot: number; item: number }
  | { type: 'bomb_kicked'; slot: number }
  | { type: 'bomb_punched'; slot: number }
  | { type: 'bomb_thrown'; slot: number }
  | { type: 'pressure_block'; gx: number; gy: number }
  | { type: 'round_end'; winners: number[] };

export function defaultRules(): Rules {
  return {
    cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false, racer: false,
    randomSpawns: true, mode: 'ffa', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, true],
  };
}
