import { ITEM, type Player } from './types';
import { randInt, type Rng } from './rng';
import { MAX_BOMBS, MAX_FIRE, MAX_SPEED, DISEASE_FRAMES } from './constants';

export const ITEM_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [ITEM.BOMB, 28], [ITEM.FIRE, 20], [ITEM.SPEED, 12], [ITEM.KICK, 10],
  [ITEM.SKULL, 9], [ITEM.PUNCH, 7], [ITEM.GLOVE, 7], [ITEM.PIERCE, 7],
];

export function rollItem(rng: Rng): number {
  let r = randInt(rng, 100);
  for (const [it, w] of ITEM_WEIGHTS) { if (r < w) return it; r -= w; }
  return ITEM.BOMB;
}

export function applyItem(p: Player, item: number, rng: Rng): void {
  switch (item) {
    case ITEM.BOMB: p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1); break;
    case ITEM.FIRE: p.fire = Math.min(MAX_FIRE, p.fire + 1); break;
    case ITEM.SPEED: p.speed = Math.min(MAX_SPEED, p.speed + 1); break;
    case ITEM.KICK: p.kick = true; break;
    case ITEM.PUNCH: p.punch = true; break;
    case ITEM.GLOVE: p.glove = true; break;
    case ITEM.PIERCE: p.pierce = true; break;
    case ITEM.SKULL: p.disease = 1 + randInt(rng, 4); p.diseaseTimer = DISEASE_FRAMES; break;
  }
}
