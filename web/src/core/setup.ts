import { CODE, type RoundState, type Rules } from './types';
import { rnd, type Rng16 } from './rng';
import { emptyRound } from './state';
import { GRID_W, SPAWNS, cellFromRomOff, cellOf, spawnX, spawnY } from './units';
import { STAGE_FACTS } from './tables/stages';
import { STAGE_ITEMS } from './tables/items';
import { FREE_CELLS } from './tables/cells';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { applyRacerPrize } from './racer';

export interface RoundOptions {
  racerPrize?: { slot: number; prize: number } | null;
  spawnOrder?: readonly number[];      // spawnOrder[slot] = índice em SPAWNS
  chars?: readonly number[];
}

/** 3×3 em volta do spawn: caminho cumulativo 0, −$40, +2, +$40, +$40, −2, −2, −$40, −$40 ($C4:1865). */
const CLEAR_PATH = [0, -GRID_W, 1, GRID_W, GRID_W, -1, -1, -GRID_W, -GRID_W];

/** Casa sorteada como no ROM: col = rnd(13), lin = rnd(11) → offset lin·$40 + col·2 + $44. */
function rollCell(s: RoundState): number {
  const col = rnd(s.rng, 13), lin = rnd(s.rng, 11);
  return cellOf(col + 2, lin + 1);
}

export function createRound(stage: number, rules: Rules, rng: Rng16, opts: RoundOptions = {}): RoundState {
  const s = emptyRound(stage, rules, rng);
  const facts = STAGE_FACTS[stage - 1];
  const order = opts.spawnOrder ?? [0, 1, 2, 3, 4];
  for (const p of s.players) {
    const [col, lin] = SPAWNS[order[p.slot]];
    p.x = spawnX(col); p.y = spawnY(lin); p.char = opts.chars?.[p.slot] ?? p.slot;
  }
  // 1. uma chamada rnd($FF) por jogador presente ($C2:02CD)
  for (const p of s.players) if (p.present) rnd(s.rng, 0xff);
  // 2. layout-base da fase
  s.grid = [...facts.base];
  const clear = (c: number): void => { s.grid[c] = facts.floorLogic[c]; };
  // 3. 3×3 em volta de cada jogador presente
  for (const p of s.players) {
    if (!p.present) continue;
    let c = cellOf(SPAWNS[order[p.slot]][0], SPAWNS[order[p.slot]][1]);
    for (const d of CLEAR_PATH) { c += d; clear(c); }
  }
  // 4. remove N soft blocks ($C4:179C)
  for (let left = facts.remove; left > 0; left--) {
    let done = false;
    for (let k = 0; k < 15 && !done; k++) { const c = rollCell(s); if (s.grid[c] === CODE.SOFT) { clear(c); done = true; } }
    if (done) continue;
    const c = FREE_CELLS.find(f => s.grid[f] === CODE.SOFT);
    if (c === undefined) break;
    clear(c);
  }
  // 5. objetos e sorteios da arena; montarias
  STAGES[stage]?.init?.(s);
  MOUNTS.current.init?.(s);
  // 6. itens escondidos ($C4:121D)
  const used = new Set<number>();
  for (const [off, item] of STAGE_ITEMS[stage - 1]) {
    let placed = -1;
    if (off === 0x44) {
      for (let k = 0; k < 15 && placed < 0; k++) { const c = rollCell(s); if (s.grid[c] === CODE.SOFT && !used.has(c)) placed = c; }
      if (placed < 0) placed = FREE_CELLS.find(f => s.grid[f] === CODE.SOFT && !used.has(f)) ?? -1;
    } else {
      const c = cellFromRomOff(off);
      if (s.grid[c] === CODE.SOFT) placed = c;
    }
    if (placed < 0) continue;
    used.add(placed);
    s.hidden.push([placed, item]);
  }
  // 7. status inicial
  for (const p of s.players) {
    if (!p.present || stage !== 5) continue;
    p.bombsCap = 5; p.bombsFree = 5; p.fire = 4; p.kick = true; p.punch = true; p.glove = true; p.pItem = true;
  }
  const rp = opts.racerPrize;
  if (rp && rules.racer && rules.mode === 'ffa' && s.players[rp.slot]?.present) applyRacerPrize(s.players[rp.slot], rp.prize);
  return s;
}
