// grab.ts — extra (não original): a luva também pega outro jogador na mesma casa, segura, arremessa ou larga.
// Quem está na mão ou voando não toma chama, não pega item e não conta como obstáculo; aperta B
// Rules.gloveEscape vezes para se soltar. Só o A pega jogador; quem está segurando B ("trancar") não pode ser pego.
import { BTN, type FlightId, type GameEvent, type Player, type RoundState } from './types';
import { LIFT_TICKS, THROW_TICKS } from './constants';
import { cellCenter } from './units';
import { newId, playerCell, setAct, standing } from './state';
import { aimThrow, dropHeld, handFrom } from './flyers';
import { isImmune } from './hit';

/** Trava de quem está na mão ou voando: só a luva/o pouso liberam. */
const GRAB_LOCK = 9999;
/** Altura de quem está na mão (px), a mesma da bomba segurada. */
export const HELD_Z = 16;

/** Na mão de alguém ou voando: fora do chão para chama, itens, contato e colisões. */
export const airborne = (p: Player): boolean => p.heldBy >= 0 || p.flying || p.act === 'dropped';
/** Algo na mão da luva: bomba ou jogador. */
export const holding = (p: Player): boolean => p.carry >= 0 || p.grab >= 0;

/** Luva: pega o jogador que está na mesma casa (prioridade sobre a bomba). */
export function tryGrab(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  if (!p.glove || p.mount || holding(p)) return false;
  const c = playerCell(p);
  const q = s.players.find(o => o !== p && standing(o) && !airborne(o) && !o.mount && !isImmune(s, o)
    && !(o.prevBtn & BTN.B) && playerCell(o) === c);
  if (!q) return false;
  if (q.carry >= 0) dropHeld(s, q);
  if (q.grab >= 0) releaseGrab(s, q);
  p.grab = q.slot; p.throwQueued = false;
  q.heldBy = p.slot; q.escape = 0; q.push.left = 0;
  setAct(s, q, 'held', GRAB_LOCK);
  follow(p, q);
  setAct(s, p, 'lift', LIFT_TICKS);
  return true;
}

function follow(p: Player, q: Player): void { q.x = p.x; q.y = p.y; q.z = HELD_Z; q.face = p.face; }

/** Solta quem está na mão na casa de quem segura (dano, atordoamento, montaria, fim da rodada, fuga). */
export function releaseGrab(s: RoundState, p: Player): void {
  const q = s.players[p.grab];
  p.grab = -1; p.throwQueued = false;
  if (!q) return;
  q.heldBy = -1; q.escape = 0; q.z = 0;
  const c = playerCell(p);
  if (c >= 0) [q.x, q.y] = cellCenter(c);
  setAct(s, q, 'idle', 0);
}

function launch(s: RoundState, p: Player, flight: FlightId, from: { x: number; y: number; z: number }): void {
  const q = s.players[p.grab];
  p.grab = -1; p.throwQueued = false;
  if (!q) return;
  const dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  q.heldBy = -1; q.escape = 0; q.flying = true;
  q.x = from.x; q.y = from.y; q.z = Math.max(0, -from.z);
  setAct(s, q, 'held', GRAB_LOCK);   // mesma pose parada da mão; a altura vem de z
  s.flyers.push({ id: newId(s), kind: 'player', ref: q.slot, x: from.x, y: from.y, z: from.z, dir, flight, script: 0, i: 0, born: s.tick });
}

/** A solto: arremesso com a mira da bomba (2..4 casas até o 1º jogador na linha, senão 5). */
export function throwGrab(s: RoundState, p: Player, ev: GameEvent[]): void {
  const cell = playerCell(p);
  const dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  const [x, y] = cellCenter(cell);
  launch(s, p, `throw${aimThrow(s, cell, p.face, p.slot)}` as FlightId, handFrom(x, y, dir));
  setAct(s, p, 'throw', THROW_TICKS);
  ev.push({ type: 'throw', slot: p.slot });
}

/** Queda de quem foi largado: o pulo de quem perde a montaria ($C2:105E 1 + $C2:10D5 51 = 52 ticks), imune, e depois
 *  32 de invencibilidade (+$96), como no desmonte. */
export const DROP_TICKS = 52;
export const DROP_INV = 32;

/** B com um jogador na mão: larga na própria casa; ele cai (`dropped`) por DROP_TICKS. */
export function tossGrab(s: RoundState, p: Player): void {
  const q = s.players[p.grab];
  p.grab = -1; p.throwQueued = false;
  if (!q) return;
  q.heldBy = -1; q.escape = 0; q.z = 0;
  const c = playerCell(p);
  if (c >= 0) [q.x, q.y] = cellCenter(c);
  // como lockAct (volta a agir em T + DROP_TICKS); de slot maior, ele ainda roda neste tick e já desconta 1
  setAct(s, q, 'dropped', DROP_TICKS - (q.slot > p.slot ? 0 : 1));
  q.actT0 = s.tick;
}

/** Quem está na mão acompanha quem segura; se um dos dois saiu do jogo, solta. */
export function tickHeld(s: RoundState): void {
  for (const p of s.players) {
    if (p.grab < 0) continue;
    const q = s.players[p.grab];
    if (!standing(p) || !q || !standing(q)) { releaseGrab(s, p); continue; }
    follow(p, q);
  }
}

/** Entrada de quem está na mão ou voando (não age); true = tick consumido. B conta para se soltar. */
export function grabbedInput(s: RoundState, q: Player, pressed: number): boolean {
  if (q.flying) return true;
  if (q.heldBy < 0) return false;
  if (pressed & BTN.B && ++q.escape >= s.rules.gloveEscape) {
    const p = s.players[q.heldBy];
    if (p) { releaseGrab(s, p); if (p.act === 'lift' || p.act === 'carryIdle' || p.act === 'carryWalk') setAct(s, p, 'idle'); }
  }
  return true;
}

/** Fim da rodada com alguém voando: pousa na casa atual (os voadores param em `won`). */
export function landNow(s: RoundState, p: Player): void {
  if (!p.flying) return;
  s.flyers = s.flyers.filter(f => !(f.kind === 'player' && f.ref === p.slot));
  p.flying = false; p.z = 0;
  const c = playerCell(p);
  if (c >= 0) [p.x, p.y] = cellCenter(c);
}
