import { CODE, ITEM, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { VEST_INV } from './constants';
import { MAX_CAPS } from './tables/misc';
import { FREE_CELLS } from './tables/cells';
import { isEggCode, isItemCode, itemCode, itemOfCode, playerCell, standing } from './state';
import { spawnItemFlyer } from './flyers';
import { cureAndThrow, rollSkull } from './disease';
import { MOUNTS } from './mounts';

export function applyItem(s: RoundState, p: Player, id: number, _ev: GameEvent[]): void {
  switch (id) {
    case ITEM.BOMB: if (p.bombsCap + 1 < MAX_CAPS.bombs) { p.bombsCap++; p.bombsFree++; } break;
    case ITEM.PIERCE: p.bombType = 2; break;
    case ITEM.FIRE: if (p.fire + 1 < MAX_CAPS.fire) p.fire++; break;
    case ITEM.FULL_FIRE: p.fullFire = true; break;
    case ITEM.SPEED: if (p.speedLv + 1 < MAX_CAPS.speed) p.speedLv++; break;
    case ITEM.REMOTE: p.bombType = 1; break;
    case ITEM.GLOVE: p.glove = true; break;
    case ITEM.VEST: p.inv = VEST_INV; break;
    case ITEM.HEART: p.heart = true; break;
    case ITEM.PASS_SOFT: p.passSoft = true; break;
    case ITEM.PASS_BOMB: p.passBomb = true; p.kick = false; break;
    case ITEM.PUNCH: p.punch = true; break;
    case ITEM.KICK: p.kick = true; p.passBomb = false; break;
    case ITEM.COSTUME: p.costume = rnd(s.rng, 8); break;
    case ITEM.P: p.pItem = true; break;
    default: if (id >= 0x21 && id <= 0x2c) { p.disease = id; p.diseaseT = 0; } break;   // $0C, $11: sem efeito no Battle
  }
}

export function pickup(s: RoundState, p: Player, ev: GameEvent[]): void {
  const c = playerCell(p);
  if (c < 0 || !isItemCode(s.grid[c])) return;
  if (isEggCode(s.grid[c])) { MOUNTS.current.stepOnEgg(s, p, c, ev); return; }
  const id = itemOfCode(s.grid[c]);
  s.grid[c] = CODE.FLOOR;
  if (p.disease) cureAndThrow(s, p, ev);
  applyItem(s, p, id, ev);
  ev.push({ type: 'item_picked', slot: p.slot, item: id });
}

/** Casa livre para um drop da morte ($C2:3922): rnd(113) na lista, avança rnd(8) até 15 vezes, depois a 1ª livre. */
export function placeDropped(s: RoundState, id: number): number {
  const free = (c: number): boolean => s.grid[c] === CODE.FLOOR && !s.players.some(q => standing(q) && playerCell(q) === c);
  let i = rnd(s.rng, 113);
  let cell = free(FREE_CELLS[i]) ? FREE_CELLS[i] : -1;
  for (let k = 0; k < 15 && cell < 0; k++) { i = (i + rnd(s.rng, 8)) % 113; if (free(FREE_CELLS[i])) cell = FREE_CELLS[i]; }
  if (cell < 0) cell = FREE_CELLS.find(free) ?? -1;
  if (cell >= 0) { s.grid[cell] = itemCode(id); s.cellT0[cell] = s.tick; }
  return cell;
}

/** Categoria k (0..9) dos drops da morte, inteira, na ordem de $C2:38F4. */
export function dropCategory(s: RoundState, p: Player, k: number, _ev: GameEvent[]): void {
  const units: number[] = [];
  const rep = (id: number, n: number): void => { for (let i = 0; i < n; i++) units.push(id); };
  switch (k) {
    case 0: rep(ITEM.BOMB, p.bombsCap - 1); p.bombsCap = 1; p.bombsFree = Math.min(p.bombsFree, 1); break;
    case 1: if (p.glove) units.push(ITEM.GLOVE); p.glove = false; break;
    case 2: if (p.bombType) units.push(p.bombType === 1 ? ITEM.REMOTE : ITEM.PIERCE); p.bombType = 0; break;
    case 3: if (p.passSoft) units.push(ITEM.PASS_SOFT); p.passSoft = false; break;
    case 4: rep(ITEM.FIRE, p.fire); p.fire = 0; break;
    case 5: if (p.punch) units.push(ITEM.PUNCH); p.punch = false; break;
    case 6: if (p.kick) units.push(ITEM.KICK); p.kick = false; break;
    case 7: if (p.passBomb) units.push(ITEM.PASS_BOMB); p.passBomb = false; break;
    case 8: rep(ITEM.SPEED, p.speedLv - 1); p.speedLv = 1; break;
    case 9: if (p.pItem) units.push(ITEM.P); p.pItem = false; break;
  }
  for (const id of units) placeDropped(s, id);
}

type Loss = (s: RoundState, p: Player, ev: GameEvent[]) => number | null;
const flag = (key: 'punch' | 'glove' | 'kick' | 'passBomb' | 'pItem' | 'fullFire', id: number): Loss =>
  (_s, p) => { if (!p[key]) return null; p[key] = false; return id; };

/** As 13 perdas de $C2:519D, na ordem da ROM. */
export const STUN_LOSS: readonly Loss[] = [
  (s, p) => { if (!p.disease) return null; p.disease = 0; return rollSkull(s); },
  (s, p, ev) => {
    if (MOUNTS.current.onStunLoss?.(s, p, ev)) return 0;
    if (p.costume < 0) return null; p.costume = -1; return ITEM.COSTUME;
  },
  (_s, p) => { if (p.speedLv <= 1) return null; p.speedLv--; return ITEM.SPEED; },
  (_s, p) => { if (p.bombsCap <= 1) return null; p.bombsCap--; if (p.bombsFree > 0) p.bombsFree--; return ITEM.BOMB; },
  (_s, p) => { if (p.fire <= 0) return null; p.fire--; return ITEM.FIRE; },
  (_s, p) => { if (!p.bombType) return null; const id = p.bombType === 1 ? ITEM.REMOTE : ITEM.PIERCE; p.bombType = 0; return id; },
  flag('punch', ITEM.PUNCH),
  flag('glove', ITEM.GLOVE),
  flag('kick', ITEM.KICK),
  (s, p) => { if (((s.grid[playerCell(p)] ?? 0) & 0xc000) !== 0 || !p.passSoft) return null; p.passSoft = false; return ITEM.PASS_SOFT; },
  flag('passBomb', ITEM.PASS_BOMB),
  flag('pItem', ITEM.P),
  flag('fullFire', ITEM.FULL_FIRE),
];

function tryLoss(s: RoundState, p: Player, idx: number, ev: GameEvent[]): boolean {
  const id = STUN_LOSS[idx](s, p, ev);
  if (id === null) return false;
  if (id > 0) spawnItemFlyer(s, id, playerCell(p), rnd(s.rng, 12));
  return true;
}

/** Índices 2..12 da lista de perdas (fora doença/traje-montaria): só estes usam `rnd(13)`. */
const hasRandomLoss = (s: RoundState, p: Player): boolean =>
  p.speedLv > 1 || p.bombsCap > 1 || p.fire > 0 || !!p.bombType || p.punch || p.glove || p.kick ||
  (p.passSoft && ((s.grid[playerCell(p)] ?? 0) & 0xc000) === 0) || p.passBomb || p.pItem || p.fullFire;

/** Perde `n` itens: por perda, doença/traje-montaria são a tentativa forçada; senão, só sorteia `rnd(13)` (até 8
 *  tentativas) se sobrar algo nessa lista — sem nada para perder, não consome RNG (t44); depois varre 0..12. */
export function loseItems(s: RoundState, p: Player, n: number, ev: GameEvent[]): void {
  for (let k = 0; k < n; k++) {
    let ok = false;
    const forced = p.disease ? 0 : p.costume >= 0 || p.mount !== null ? 1 : -1;
    if (forced >= 0) ok = tryLoss(s, p, forced, ev);
    else if (hasRandomLoss(s, p)) for (let a = 0; a < 8 && !ok; a++) ok = tryLoss(s, p, rnd(s.rng, 13), ev);
    for (let idx = 0; idx < 13 && !ok; idx++) ok = tryLoss(s, p, idx, ev);
    if (!ok) return;
  }
}

/** Doença $2B ($C2:5270): 1 tentativa rnd(12)+1 e depois varre 1..11 (nunca a própria doença). */
export function leakOne(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (tryLoss(s, p, rnd(s.rng, 12) + 1, ev)) return;
  for (let idx = 1; idx < 12; idx++) if (tryLoss(s, p, idx, ev)) return;
}
