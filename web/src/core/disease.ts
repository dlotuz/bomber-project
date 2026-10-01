import { BTN, DIR_BTNS, DISEASE, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { CONTACT_PX, LEAK_EVERY } from './constants';
import { INVISIBLE_PATTERN } from './tables/misc';
import { px } from './units';
import { playerCell, standing } from './state';
import { spawnItemFlyer } from './flyers';
import { leakOne } from './items';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';

function swapDirs(b: number): number {
  let out = b & ~DIR_BTNS;
  if (b & BTN.UP) out |= BTN.DOWN;
  if (b & BTN.DOWN) out |= BTN.UP;
  if (b & BTN.LEFT) out |= BTN.RIGHT;
  if (b & BTN.RIGHT) out |= BTN.LEFT;
  return out;
}

export function applyDiseaseInput(_s: RoundState, p: Player, btn: number): number {
  let b = btn;
  if (b & DIR_BTNS) p.lastDir = b & DIR_BTNS;
  else if (p.disease === DISEASE.NO_STOP) b |= p.lastDir;
  if (p.disease === DISEASE.REVERSE || p.effect.kind === 0x0a) b = swapDirs(b);
  return b;
}

export function speedLevel(s: RoundState, p: Player): number {
  let lv = p.disease === DISEASE.FAST ? 6 : p.disease === DISEASE.SLOW ? 7 : p.speedLv;
  if (p.effect.kind === 2) lv = 7;
  lv = MOUNTS.current.speedLevel?.(p) ?? lv;   // tipo B: $C2:2F40 decide antes da doença
  return STAGES[s.stage]?.speedLevel?.(s, p, lv) ?? lv;   // plano 8 (D10): o nível da arena vence doença e efeito
}

export function tickDisease(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.effect.kind && (s.tick & 3) === 0 && --p.effect.left <= 0) p.effect = { kind: 0, left: 0 };
  if (!p.disease) return;
  p.diseaseT++;
  if (p.disease === DISEASE.LEAK && (s.tick & (LEAK_EVERY - 1)) === 0) leakOne(s, p, ev);
}

export function inContact(a: Player, b: Player): boolean {
  return Math.abs(px(a.x) - px(b.x)) <= CONTACT_PX && Math.abs(px(a.y) - px(b.y)) <= CONTACT_PX;
}

export function contagion(s: RoundState, ev: GameEvent[]): void {
  if (s.phase !== 'play') return;
  const live = s.players.filter(p => standing(p) && p.heldBy < 0 && !p.flying);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const bitA = 1 << a.slot, bitB = 1 << b.slot;
    if (!inContact(a, b)) { a.contactLock &= ~bitB; b.contactLock &= ~bitA; continue; }
    if (a.contactLock & bitB) continue;
    const [from, to] = a.disease && !b.disease ? [a, b] : b.disease && !a.disease ? [b, a] : [null, null];
    if (!from || !to) continue;
    to.disease = from.disease; to.diseaseT = 0; from.disease = 0; from.diseaseT = 0;
    a.contactLock |= bitB; b.contactLock |= bitA;
    ev.push({ type: 'disease_passed', from: from.slot, to: to.slot });
  }
}

/** Caveira nova ($C2:5481): rnd(12)+1 | $20; $2C sorteia de novo; $24 só 1 vez por rodada ($1EE4). */
export function rollSkull(s: RoundState): number {
  for (;;) {
    const id = (rnd(s.rng, 12) + 1) | 0x20;
    if (id === DISEASE.SWAP) continue;
    if (id === DISEASE.CONSTIPATION) { if (s.diseaseOnce24) continue; s.diseaseOnce24 = true; }
    return id;
  }
}

export function cureAndThrow(s: RoundState, p: Player, _ev: GameEvent[]): void {
  if (!p.disease) return;
  p.disease = 0; p.diseaseT = 0;
  const id = rollSkull(s);
  spawnItemFlyer(s, id, playerCell(p), rnd(s.rng, 12));
}

/** $C2:4E06: visível se o bit (t & 7) de PATTERN[(t >> 3) & (tamanho−1)] estiver ligado.
 *  A máscara vem do tamanho da tabela (não hardcoded) porque INVISIBLE_PATTERN (T2) está em revisão. */
export function invisibleVisible(p: Player): boolean {
  if (p.disease !== DISEASE.INVISIBLE) return true;
  const t = p.diseaseT;
  const mask = INVISIBLE_PATTERN.length - 1;
  return ((INVISIBLE_PATTERN[(t >> 3) & mask] >> (t & 7)) & 1) === 1;
}
