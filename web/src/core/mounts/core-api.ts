import { CODE, type RoundState, type Player, type GameEvent, type PlayerAct } from '../types';
import { setAct } from '../state';
import { addBomb, bombAt, canPlaceBomb, bombFireOf, fuseOf, explodeBomb, bombOccupies } from '../bombs';
import { MOUNTS } from './index';
import { CHAIN_DELAY, FIRE_LINE, rangeOf } from '../constants';
import { CAPSULE_TYPES, CAPSULE_TYPES_ALL } from '../tables/misc';   // $C1:5DA4 / $C1:5D87 (gerado pelo plano 6, §3.16)

import { rnd } from '../rng';
export { rnd };
export { GRID_W, GRID_H, cellOf, colOf, linOf, cellAt, centerX, centerY } from '../units';
export { isEggCode } from '../state';

/** Tipos de montaria sorteáveis: $C1:5DA4 & $0F = [2,3,A,C,D,E,F] × 2. */
export const EGG_TYPES: readonly number[] = CAPSULE_TYPES.map((v: number) => v & 0x0f);
/** Com a senha 0164 ($C1:5DC0): $C1:5D87 & $0F = [1,2,3,4,5,6,9,A,B,C,D,E,F] × 2, por rnd(26). */
export const EGG_TYPES_ALL: readonly number[] = CAPSULE_TYPES_ALL.map((v: number) => v & 0x0f);
/** Tipo do ovo revelado: rnd(14) na tabela normal ou rnd(26) na da senha. */
export const rollEggType = (s: RoundState): number =>
  s.rules.allMounts ? EGG_TYPES_ALL[rnd(s.rng, 26)] : EGG_TYPES[rnd(s.rng, 14)];

/** Bomba de `p` na casa `cell`, com as regras da colocação normal (decisão 13 do plano 6: $24 impede, $25 exige todas
 *  livres e dá fogo 10, fogo total dá 7, tipo = MOUNTS.current.bombType?.(p) ?? p.bombType). Gasta 1 disponível e emite
 *  bomb_placed. Devolve false (sem efeito) se não puder colocar, se a casa não for piso ou se uma bomba já a ocupar
 *  (`bombOccupies` de `core/bombs.ts`, mesmo teste de `placeBomb` — correção do plano 6 aplicada pelo plano 9/tarefa 10). */
export function placeBombAt(s: RoundState, p: Player, cell: number, ev: GameEvent[]): boolean {
  if (!canPlaceBomb(p) || cell < 0 || s.grid[cell] !== CODE.FLOOR) return false;
  if (bombOccupies(s, cell)) return false;
  addBomb(s, p.slot, cell, { fire: bombFireOf(p), type: MOUNTS.current.bombType?.(p) ?? p.bombType, fuse: fuseOf(p) });
  p.bombsFree--;
  ev.push({ type: 'bomb_placed', slot: p.slot, cell });
  return true;
}

/** Explosão imediata em cruz na casa `cell` (range 2 = fogo 0), sem perfurar, dono `owner`; emite `explosion`.
 *  Não é bomba do jogador: explodeBomb devolve a bomba ao dono (refundBomb), então o `bombsFree` é restaurado. */
export function explodeAt(s: RoundState, cell: number, range: number, owner: number, ev: GameEvent[]): void {
  const fire = range === 1 ? 10 : range >= rangeOf(FIRE_LINE) ? FIRE_LINE : range - 2;
  const p = s.players[owner];
  const free = p.bombsFree;
  // Bomba parada já na casa (ex.: a linha de bombas da montaria C caiu sob o D no mesmo tick): como o braço que chega
  // numa bomba ($C1:40EF), ela entra na cadeia e a casa continua dela; sem isso sobrava uma bomba sob a chama, fora da
  // grade. (Não medido na ROM.)
  const under = s.grid[cell] === CODE.BOMB ? bombAt(s, cell) : undefined;
  if (under && (under.chainAt === 0 || under.chainAt > s.tick + CHAIN_DELAY)) under.chainAt = s.tick + CHAIN_DELAY;
  const b = addBomb(s, owner, cell, { fire, type: 0 });
  explodeBomb(s, b, ev);
  if (under) s.grid[cell] = CODE.BOMB;
  p.bombsFree = free;
}

/** Trava o jogador em `act`: chamado durante o tick atual T, ele volta a agir no tick T + ticks.
 *  setAct(s, p, act, left) do plano 6: tickAct trava enquanto actLeft > 0 na entrada do tick e decrementa, logo
 *  left = ticks − 1 deixa o jogador travado de T + 1 a T + ticks − 1 e livre em T + ticks (teste do Step 7). */
export function lockAct(s: RoundState, p: Player, act: PlayerAct, ticks: number): void {
  setAct(s, p, act, Math.max(0, ticks - 1));
  p.actT0 = s.tick;
}

/** Adversário: presente, de pé, outro slot e, em Team Battle, de outro time (Rules.mode/teams do plano 6). */
export function isEnemy(s: RoundState, a: Player, b: Player): boolean {
  if (!b.present || b.state !== 'alive' || b.slot === a.slot) return false;
  return s.rules.mode !== 'team' || s.rules.teams[a.slot] !== s.rules.teams[b.slot];
}
