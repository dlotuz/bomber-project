import { CELL, DIR, ITEM, type GameEvent, type Player, type RoundState, type Rules } from './types';
import { DEATH_FRAMES, DISEASE_FRAMES, INTRO_FRAMES, PRESSURE_INTERVAL, PRESSURE_RINGS, PRESSURE_START_FRAMES, SPAWNS, TIME_OPTIONS_FRAMES } from './constants';
import { cellX, cellY, centerX, centerY, idx } from './grid';
import { buildArena, tickArena } from './arena';
import { makeRng, shuffle, type Rng } from './rng';
import { playerActions, steerPlayer } from './player';
import { updateBombs } from './bombs';
import { applyItem } from './items';

export function ringCells(k: number): number[] {
  const x0 = 1 + k, x1 = 13 - k, y0 = 1 + k, y1 = 11 - k;
  const out: number[] = [];
  if (x0 > x1 || y0 > y1) return out;
  for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
  for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
  if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
  if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
  return out;
}

export function pressureOrder(fromRing: number, toRing: number): number[] {
  const out: number[] = [];
  for (let k = fromRing; k < toRing; k++) out.push(...ringCells(k));
  return out;
}

export function makePlayers(stage: number, rules: Rules, rng: Rng): Player[] {
  const order = [0, 1, 2, 3, 4];
  if (rules.randomSpawns) shuffle(rng, order);
  return order.map((spawn, slot) => {
    const [gx, gy] = SPAWNS[spawn];
    const p: Player = {
      slot, active: rules.active[slot], team: rules.teams[slot],
      x: centerX(gx), y: centerY(gy), facing: DIR.DOWN,
      speed: rules.racer ? 4 : 1, maxBombs: 1, fire: 0,
      kick: false, punch: false, glove: false, pierce: false,
      disease: 0, diseaseTimer: 0, alive: rules.active[slot], dying: 0,
      prevButtons: 0, carrying: -1,
    };
    if (stage === 5) { p.maxBombs = 5; p.fire = 4; p.kick = p.punch = p.glove = p.pierce = true; }
    return p;
  });
}

export function createRound(stage: number, rules: Rules, seed: number): RoundState {
  const rng = makeRng(seed);
  const arena = buildArena(stage, rng);
  const players = makePlayers(stage, rules, rng);
  return {
    rng, frame: 0, phase: 'intro', introLeft: INTRO_FRAMES,
    timeLeft: TIME_OPTIONS_FRAMES[rules.timeIdx], stage, rules,
    players, bombs: [], nextBombId: 1, arena,
    pressure: { order: TIME_OPTIONS_FRAMES[rules.timeIdx] < 0 ? [] : pressureOrder(0, PRESSURE_RINGS), next: 0, timer: 0, overtime: false }, winners: [],
  };
}

export function killPlayer(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.dying > 0 || !p.alive) return;
  p.dying = DEATH_FRAMES;
  if (p.carrying >= 0) {
    const b = s.bombs.find(x => x.id === p.carrying);
    if (b) { b.carried = false; b.x = centerX(cellX(p.x)); b.y = centerY(cellY(p.y)); }
    p.carrying = -1;
  }
  ev.push({ type: 'player_hit', slot: p.slot });
}

function applyHazards(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (!p.active || !p.alive || p.dying > 0) continue;
    const i = idx(cellX(p.x), cellY(p.y));
    if (s.arena.flame[i] > 0 || s.arena.cells[i] === CELL.HARD) killPlayer(s, p, ev);
  }
}

function tickDying(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (p.dying > 0 && --p.dying === 0) { p.alive = false; ev.push({ type: 'player_out', slot: p.slot }); }
  }
}

function dropBlock(s: RoundState, i: number, ev: GameEvent[]): void {
  const a = s.arena;
  a.cells[i] = CELL.HARD; a.items[i] = ITEM.NONE; a.hidden[i] = ITEM.NONE; a.burning[i] = 0; a.flame[i] = 0;
  s.bombs = s.bombs.filter(b => b.carried || b.flight || idx(cellX(b.x), cellY(b.y)) !== i);
  ev.push({ type: 'pressure_block', gx: i % 15, gy: Math.floor(i / 15) });
}

function tickClock(s: RoundState, ev: GameEvent[]): void {
  if (s.timeLeft < 0) return;
  if (s.timeLeft > 0) s.timeLeft--;
  const pr = s.pressure;
  if (s.timeLeft === 0 && s.rules.suddenDeath && !pr.overtime) {
    pr.overtime = true;
    pr.order = pr.order.concat(pressureOrder(PRESSURE_RINGS, 6));
  }
  if (s.timeLeft > PRESSURE_START_FRAMES) return;
  if (!pr.overtime && ++pr.timer < PRESSURE_INTERVAL) return;
  pr.timer = 0;
  while (pr.next < pr.order.length && s.arena.cells[pr.order[pr.next]] === CELL.HARD) pr.next++;
  if (pr.next < pr.order.length) dropBlock(s, pr.order[pr.next++], ev);
}

function checkEnd(s: RoundState, ev: GameEvent[]): void {
  if (s.players.some(p => p.active && p.alive && p.dying > 0)) return;
  const standing = s.players.filter(p => p.active && p.alive);
  let done = false;
  let winners: number[] = [];
  if (s.rules.mode === 'team') {
    const teams = [...new Set(standing.map(p => p.team))];
    if (teams.length <= 1) {
      done = true;
      if (teams.length === 1) winners = s.players.filter(p => p.active && p.team === teams[0]).map(p => p.slot);
    }
  } else if (standing.length <= 1) {
    done = true;
    winners = standing.map(p => p.slot);
  }
  if (!done && s.timeLeft === 0 && !s.rules.suddenDeath) { done = true; winners = []; }
  if (done) { s.phase = 'result'; s.winners = winners; ev.push({ type: 'round_end', winners }); }
}

function pickupsAndContagion(s: RoundState, ev: GameEvent[]): void {
  const standing = s.players.filter(p => p.active && p.alive && p.dying === 0);
  for (const p of standing) {
    const i = idx(cellX(p.x), cellY(p.y));
    const it = s.arena.items[i];
    if (it !== ITEM.NONE) {
      applyItem(p, it, s.rng);
      s.arena.items[i] = ITEM.NONE;
      ev.push({ type: 'item_picked', slot: p.slot, item: it });
    }
  }
  for (let a = 0; a < standing.length; a++) for (let b = a + 1; b < standing.length; b++) {
    const p = standing[a], q = standing[b];
    if (cellX(p.x) !== cellX(q.x) || cellY(p.y) !== cellY(q.y)) continue;
    if (p.disease && !q.disease) { q.disease = p.disease; q.diseaseTimer = DISEASE_FRAMES; }
    else if (q.disease && !p.disease) { p.disease = q.disease; p.diseaseTimer = DISEASE_FRAMES; }
  }
}

export function step(s: RoundState, inputs: number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'result') return ev;
  s.frame++;
  if (s.phase === 'intro') {
    if (--s.introLeft <= 0) s.phase = 'playing';
    for (const p of s.players) p.prevButtons = inputs[p.slot] ?? 0;
    return ev;
  }
  tickArena(s);
  for (const p of s.players) {
    if (!p.active || !p.alive) continue;
    const btn = inputs[p.slot] ?? 0;
    if (p.dying === 0) {
      if (p.disease && --p.diseaseTimer <= 0) p.disease = 0;
      steerPlayer(s, p, btn, ev);
      playerActions(s, p, btn, ev);
    }
    p.prevButtons = btn;
  }
  updateBombs(s, ev);
  pickupsAndContagion(s, ev);
  applyHazards(s, ev);
  tickDying(s, ev);
  tickClock(s, ev);
  checkEnd(s, ev);
  return ev;
}
