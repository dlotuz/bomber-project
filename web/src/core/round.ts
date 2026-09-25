import { DIR, type Player, type RoundState, type Rules } from './types';
import { INTRO_FRAMES, SPAWNS, TIME_OPTIONS_FRAMES } from './constants';
import { centerX, centerY } from './grid';
import { buildArena } from './arena';
import { makeRng, shuffle, type Rng } from './rng';

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
