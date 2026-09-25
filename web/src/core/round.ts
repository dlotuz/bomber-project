import { CELL, DIR, type GameEvent, type Player, type RoundState, type Rules } from './types';
import { DEATH_FRAMES, INTRO_FRAMES, SPAWNS, TIME_OPTIONS_FRAMES } from './constants';
import { cellX, cellY, centerX, centerY, idx } from './grid';
import { buildArena, tickArena } from './arena';
import { makeRng, shuffle, type Rng } from './rng';
import { playerActions, steerPlayer } from './player';
import { updateBombs } from './bombs';

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
    pressure: { order: [], next: 0, timer: 0, overtime: false }, winners: [],
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
      steerPlayer(s, p, btn, ev);
      playerActions(s, p, btn, ev);
    }
    p.prevButtons = btn;
  }
  updateBombs(s, ev);
  applyHazards(s, ev);
  tickDying(s, ev);
  return ev;
}
