import { BTN, CODE, DISEASE, type GameEvent, type Player, type PlayerAct, type RoundState } from './types';
import { DETONATE_TICKS, P_ADVANCE_TICKS, P_PUSH_TICKS, P_SPEED, P_TICKS } from './constants';
import { cellAt, cellCenter, faceDcol, faceDlin, faceStep } from './units';
import { playerCell, setAct, standing } from './state';
import { movePlayer } from './movement';
import { stopKick, tryKick } from './kick';
import { detonateRemote, placeBomb } from './bombs';
import { punchBomb, startLift, throwHeld, tossHeld } from './flyers';
import { isImmune } from './hit';
import { MOUNTS } from './mounts';
import { STAGES } from './stages';

const FREE: ReadonlySet<PlayerAct> = new Set(['idle', 'walk', 'carryIdle', 'carryWalk', 'victory', 'dying', 'bad']);
/** Bloqueia o avanço/empurrão: parede, pilar, soft, bomba, queimando, pressão (bit $8000). */
const solid = (v: number): boolean => (v & 0x8000) !== 0;

/** Movimento forçado de um tick (avanço do P e vítima do P). Para alinhado antes de casa sólida. */
export function applyPush(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const pu = p.push;
  if (pu.left <= 0) return false;
  const c0 = playerCell(p), c1 = cellAt(p.x + pu.vx, p.y + pu.vy);
  if (c1 !== c0 && (c1 < 0 || solid(s.grid[c1]))) { pu.left = 0; [p.x, p.y] = cellCenter(c0); return false; }
  p.x += pu.vx; p.y += pu.vy; pu.left--;
  STAGES[s.stage]?.outOfBounds?.(s, p, ev);
  return true;
}

/** Avança a ação travada; true = travado neste tick (o jogador não obedece aos botões). */
export function tickAct(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (p.push.left > 0) applyPush(s, p, ev);
  if (p.actLeft <= 0) return false;
  if (--p.actLeft === 0) {
    if (p.act === 'lift') { if (p.throwQueued) throwHeld(s, p, ev); else setAct(s, p, 'carryIdle'); }
    else if (!FREE.has(p.act)) setAct(s, p, p.carry >= 0 ? 'carryIdle' : 'idle');
  }
  return true;
}

/** Golpe P: avanço de 16 px (4 ticks), 35 ticks na ação; quem está na casa da frente é empurrado 48 px (12 ticks). */
export function startPPunch(s: RoundState, p: Player, ev: GameEvent[]): void {
  const front = faceStep(playerCell(p), p.face);
  const vx = faceDcol(p.face) * P_SPEED, vy = faceDlin(p.face) * P_SPEED;
  if (p.punch) punchBomb(s, p, ev);
  for (const q of s.players) {
    if (q === p || !standing(q) || isImmune(s, q) || playerCell(q) !== front) continue;
    q.push = { vx, vy, left: P_PUSH_TICKS };
    setAct(s, q, 'pushed', P_PUSH_TICKS);
  }
  // avanço de 16 px (4 px/tick × 4) como movimento forçado; contra casa sólida à frente não sai do lugar
  if (!solid(s.grid[front] ?? CODE.HARD)) p.push = { vx, vy, left: P_ADVANCE_TICKS };
  setAct(s, p, 'pPunch', P_TICKS);
  ev.push({ type: 'p_punch', slot: p.slot });
}

/** Botões de um jogador num tick (ordem da decisão 20). */
export function playerActions(s: RoundState, p: Player, btn: number, pressed: number, released: number, ev: GameEvent[]): void {
  if (released & BTN.A && p.carry >= 0) {
    if (p.act === 'lift' && p.actLeft > 0) p.throwQueued = true;
    else { throwHeld(s, p, ev); return; }
  }
  if (tickAct(s, p, ev)) return;
  movePlayer(s, p, btn, ev);
  tryKick(s, p, ev);
  if (pressed & BTN.A) { if (p.carry < 0 && !(p.glove && startLift(s, p, ev))) placeBomb(s, p, ev); }
  else if (p.disease === DISEASE.DIARRHEA && p.carry < 0) placeBomb(s, p, ev);
  if (pressed & BTN.B && p.carry >= 0) {   // luva: B larga a bomba na casa da frente
    tossHeld(s, p);
    setAct(s, p, 'idle');
  } else if (pressed & BTN.B) { detonateRemote(s, p, ev); setAct(s, p, 'detonate', DETONATE_TICKS); }
  if (pressed & BTN.X) stopKick(s, p);
  if (pressed & BTN.Y && !MOUNTS.current.onY(s, p, ev)) {
    if (p.pItem) startPPunch(s, p, ev);
    else if (p.punch) punchBomb(s, p, ev);
  }
}
