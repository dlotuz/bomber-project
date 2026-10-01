import { CODE, type GameEvent, type Player, type RoundState } from './types';
import { rnd } from './rng';
import { DROP_EVERY, DROP_START, HIT_INV, OUT_AT, STUN_TICKS } from './constants';
import { playerCell, setAct } from './state';
import { dropCategory, loseItems } from './items';
import { dropFront, dropHeld } from './flyers';
import { becomeBad } from './bad-bomber';
import { MOUNTS } from './mounts';
import { airborne, releaseGrab } from './grab';

export const isImmune = (s: RoundState, p: Player): boolean => s.phase === 'won' && p.state === 'alive';

/** Desconta a invencibilidade (+$96) e devolve true no tick em que ela acaba: o DEC de $C1:77E7/$C1:775B que zera +$96
 *  põe +$E0 = $FF, e $C2:4B5C ainda trata esse tick como invencível (emulador: chama em H+84 do desmonte não mata). */
export function tickInv(p: Player): boolean {
  if (p.inv <= 0) return false;
  return --p.inv === 0;
}

/** `justExpired` = a invencibilidade acabou neste tick (+$E0 da ROM): a chama ainda não mata; a pressão mata sempre. */
export function checkHit(s: RoundState, p: Player, ev: GameEvent[], justExpired = false): void {
  if (p.state !== 'alive' || isImmune(s, p) || airborne(p)) return;   // na mão ou voando: fora do chão
  const c = playerCell(p);
  if (c < 0) return;
  const v = s.grid[c];
  if (v === CODE.PRESSURE) hitPlayer(s, p, 'pressure', ev);
  else if (v === CODE.FLAME && p.inv <= 0 && !justExpired) hitPlayer(s, p, 'flame', ev);
}

export function hitPlayer(s: RoundState, p: Player, cause: 'flame' | 'pressure', ev: GameEvent[]): void {
  if (p.state !== 'alive') return;
  if (cause === 'flame') {
    if (MOUNTS.current.onHit(s, p, ev)) return;
    if (p.costume >= 0) { p.costume = -1; p.inv = HIT_INV; return; }
    if (p.heart) { p.heart = false; p.inv = HIT_INV; return; }
  }
  if (p.carry >= 0) dropHeld(s, p);
  if (p.grab >= 0) releaseGrab(s, p);
  p.state = 'dying'; p.hitT0 = s.tick; s.lastHit = s.tick;
  p.disease = 0; p.diseaseT = 0; p.push.left = 0;
  setAct(s, p, 'dying', 0);
  ev.push({ type: 'player_hit', slot: p.slot });
}

export function tickDeath(s: RoundState, p: Player, ev: GameEvent[]): void {
  const k = s.tick - p.hitT0;
  const d = k - DROP_START;
  if (d >= 0 && d % DROP_EVERY === 0 && d / DROP_EVERY < 10) dropCategory(s, p, d / DROP_EVERY, ev);
  if (k >= OUT_AT) {
    // Bad Bomber só nasce com a rodada em jogo: em `won`/`timeUp` os Bad Bombers congelam e o resultado já saiu
    if (s.rules.badBomber && s.pressure.trigger < 0 && s.phase === 'play') becomeBad(s, p);
    else p.state = 'out';
  }
}

/** Atordoamento ($C2:4C54 → $C2:0E29). Já atordoado, ignora: o estado de atordoamento ($C2:0E86) não chama a checagem
 *  do pedido ($C2:4C54) e, ao fim dos 64 ticks, apaga o pedido pendente ($C2:59AB, bit $0002 de +$C0).
 *  Montado: $C2:0E29 chama as perdas ($C2:51C4) do mesmo jeito e só depois olha +$5D para a anim montada; a montaria
 *  fica (não está na lista de perdas).
 *  Invencível (+$96 ≠ 0): $C2:59D6, por onde passam os pedidos de atordoamento (bomba que cai em cima, $C1:294D; bola da
 *  arena 3, $C3:0A9B), não pede nada e apaga o pedido pendente — vale também logo depois de perder a montaria.
 *  `ignoreInv`: a cerca da arena 5 atordoa por outro caminho ($C2:319B → +$51 bit 4, não passa por $C2:59D6); fica
 *  como antes (não conferido contra +$96). */
export function stunPlayer(s: RoundState, p: Player, ev: GameEvent[], ignoreInv = false): void {
  if (p.state !== 'alive' || isImmune(s, p) || p.act === 'stunned' || airborne(p)) return;
  if (p.inv > 0 && !ignoreInv) return;
  if (p.carry >= 0) dropFront(s, p);
  if (p.grab >= 0) releaseGrab(s, p);
  p.push.left = 0;
  setAct(s, p, 'stunned', STUN_TICKS);
  loseItems(s, p, ((rnd(s.rng, 0xff) & 6) >> 1) + 1, ev);
  ev.push({ type: 'stunned', slot: p.slot });
}
