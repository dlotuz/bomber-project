// Ponte única entre os módulos de arena e o núcleo do plano 6. Se um nome do núcleo mudar, só este arquivo muda.
import { BURN, CODE, FLAME_PIECE, type Bomb, type GameEvent, type Player, type RoundState, type Flyer } from '../types';
import { rnd } from '../rng';
import { cellAt, cellOf, centerX, centerY, colOf, linOf, px } from '../units';
import { isEggCode, itemCode, newId, playerCell, setAct, standing } from '../state';
import { PRESSURE_BORDER_AT, PRESSURE_STEPS_SD, STUN_TICKS, FUSE } from '../constants';
import { isImmune, stunPlayer } from '../hit';
import { addBomb } from '../bombs';
import { launchBomb } from '../flyers';

export { BURN, CODE, rnd, cellAt, cellOf, centerX, centerY, colOf, linOf, px, playerCell, setAct, standing, itemCode };
export type { Bomb, GameEvent, Player, RoundState };

/** rnd com Y = $FFFF ($C3:5489): n efetivo $FF. É o sorteio de todos os objetos de arena. */
export const rnd255 = (s: RoundState): number => rnd(s.rng, 0xff);

/** Ticks lógicos do intro em que a ROM já roda os objetos de arena e o nosso passo não chama `tick` (D3). */
export const INTRO_LOGIC = 10;

export function stageEvent(ev: GameEvent[], id: string, extra: { slot?: number; cell?: number } = {}): void {
  ev.push({ type: 'stage', id, ...extra });
}

/** armDir do núcleo → 0 cima, 1 direita, 2 baixo, 3 esquerda, 4 centro (conferido na Task 1, item 3). */
export function armIndex(armDir: number): 0 | 1 | 2 | 3 | 4 {
  if (armDir < 0) return 4;
  return ((armDir >> 1) & 3) as 0 | 1 | 2 | 3;
}

/** Grava chama numa casa especial (arenas 7 e 8, D16): letal e visível; o núcleo a apaga aos 25 ticks. */
export function flameOver(s: RoundState, cell: number, armDir: number): void {
  const k = armIndex(armDir);
  s.grid[cell] = CODE.FLAME;
  s.cellT0[cell] = s.tick;
  s.cellAux[cell] = [FLAME_PIECE.ARM_UP, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_DOWN, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.CENTER][k];
}

/** Soft → queimando 24 ticks (o núcleo revela o item escondido no fim), como $C1:4288. */
export function burnSoft(s: RoundState, cell: number): void {
  s.grid[cell] = CODE.BURNING;
  s.cellT0[cell] = s.tick;
  s.cellAux[cell] = BURN.SOFT;
}

/** Volta a casa ao piso lógico ($C1:532C sem os ganchos): apaga item, chama ou código especial. */
export function restoreFloor(s: RoundState, cell: number): void {
  s.grid[cell] = CODE.FLOOR;
  s.cellAux[cell] = 0;
}

/** Palavra de piso da casa: floor[cell] ou, se 0, a palavra padrão da arena. */
export const floorWord = (s: RoundState, cell: number, dflt: number): number => s.floor[cell] || dflt;

/** De pé e sob controle (sem ação travada nem empurrão). */
export const onGround = (p: Player): boolean => standing(p) && p.actLeft === 0 && p.push.left === 0;

/** Atordoamento do núcleo (perdas 1–4 + 63 ticks). */
export function stun(s: RoundState, p: Player, ev: GameEvent[]): void { stunPlayer(s, p, ev); }

/** Choque da cerca (arena 5): atordoamento com act `shocked` e SFX $18. Nada se `stunPlayer` não faria nada
 *  (jogador não vivo ou imune — mesma guarda de $C0:xxxx que a ROM usa antes de atordoar). */
export function shock(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.state !== 'alive' || isImmune(s, p)) return;
  p.push = { vx: 0, vy: 0, left: 0 };
  stunPlayer(s, p, ev);
  setAct(s, p, 'shocked', p.actLeft > 0 ? p.actLeft : STUN_TICKS);
  stageEvent(ev, 'a5_shock', { slot: p.slot });
}

/** Item (ou ovo) que termina de cair na casa: piso → item; queimando/pressão → some; resto → quica (voador do núcleo). */
export function landItem(s: RoundState, item: number, cell: number): void {
  const g = cell >= 0 ? s.grid[cell] : CODE.HARD;
  if (g === CODE.FLOOR) { s.grid[cell] = itemCode(item); s.cellT0[cell] = s.tick; return; }
  if (g === CODE.BURNING || g === CODE.PRESSURE || g === CODE.FALLING || cell < 0) return;
  const f: Flyer = { id: newId(s), kind: 'item', ref: item, x: centerX(colOf(cell)), y: centerY(linOf(cell)), z: 0,
    dir: 2, flight: 'bounce', script: 0, i: 0, born: s.tick };
  s.flyers.push(f);
}

/** Bomba (fogo 4, sem dono) que termina de cair: jogador de pé → atordoa e quica; piso → bomba parada; resto → quica. */
export function landBomb(s: RoundState, cell: number, ev: GameEvent[]): void {
  if (cell < 0) return;
  const hit = s.players.filter(p => standing(p) && playerCell(p) === cell);
  for (const p of hit) stunPlayer(s, p, ev);
  const g = s.grid[cell];
  if (g === CODE.BURNING || g === CODE.PRESSURE) return;
  if (g === CODE.FLOOR && hit.length === 0) { addBomb(s, -1, cell, { fire: 4, fuse: FUSE }); return; }
  const b: Bomb = addBomb(s, -1, cell, { fire: 4, fuse: FUSE, state: 'air' });
  launchBomb(s, b, 'bounce', 2, { x: centerX(colOf(cell)), y: centerY(linOf(cell)), z: 0 });
}

/** Jackpot do caça-níquel ($C1:7027): pressão total começando já, sem aviso. */
export function startJackpotPressure(s: RoundState): void {
  // Bordas no tick seguinte e 1º passo 13 depois; antes do tick 191 o gatilho não pode ser negativo (🟡, atrasa as bordas).
  if (s.pressure.trigger < 0) s.pressure.trigger = Math.max(0, s.tick - (PRESSURE_BORDER_AT - 1));
  s.pressure.total = PRESSURE_STEPS_SD;
}

/** Ovos no chão + ovos voando + montarias + ovos de reserva (substituto do $1ED4 da ROM, 🟡). As reservas contam como
 *  no `activeCount` do plano 9 (L2): sem elas, montado com 1 reserva + 1 ovo do caça-níquel passava do teto de 2 (T16). */
export function eggsInPlay(s: RoundState, extra = 0): number {
  let n = extra;
  for (const v of s.grid) if (isEggCode(v)) n++;
  for (const f of s.flyers) if (f.kind === 'item' && f.ref >= 0x30 && f.ref <= 0x3f) n++;
  for (const p of s.players) if (p.mount !== null) n += 1 + ((p.mount as { reserves?: readonly unknown[] }).reserves?.length ?? 0);
  return n;
}

/** Volta pela borda do voo da gangorra, em px (D15). */
export const wrapPx = (x: number): number => (x < -24 ? x + 272 : x > 278 ? x - 272 : x);
