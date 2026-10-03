import { BTN, CODE, DIR_BTNS, DISEASE, type GameEvent, type Player, type PlayerAct, type RoundState } from './types';
import { DETONATE_TICKS, P_ADVANCE_TICKS, P_PUSH_TICKS, P_SPEED, P_TICKS } from './constants';
import { cellAt, cellCenter, faceDcol, faceDlin, faceStep } from './units';
import { playerCell, setAct, standing } from './state';
import { movePlayer } from './movement';
import { tryKick } from './kick';
import { detonateRemote, placeBomb } from './bombs';
import { punchBomb, startLift, throwHeld, tossHeld } from './flyers';
import { isImmune } from './hit';
import { DROP_INV, airborne, grabbedInput, holding, throwGrab, tossGrab, tryGrab } from './grab';
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
    if (p.act === 'lift') setAct(s, p, 'carryIdle');   // T+8: já na mão, ainda parado (o arremesso marcado sai em T+9)
    else if (p.act === 'detonate' && p.prevBtn & BTN.B) { /* trancar: B ainda segurado, fica na pose */ }
    else if (p.act === 'dropped') { p.inv = DROP_INV; setAct(s, p, 'idle'); }   // caiu da luva: invencível, como no desmonte
    else if (!FREE.has(p.act)) setAct(s, p, holding(p) ? 'carryIdle' : 'idle');
  }
  return true;
}

/** Golpe P: avanço de 16 px (4 ticks), 35 ticks na ação; quem está a pé na casa da frente é empurrado 48 px (12 ticks).
 *  Montado (qualquer fase) não é alvo: $C2:499F procura na ocupação $7F:1000 com a máscara $01F0, só os bits "a pé"
 *  (+$90); montado a casa tem +$92 ($C2:33FC) e, montando/desmontando, nenhum bit ($C2:3419). Medido: aj-pmount. */
export function startPPunch(s: RoundState, p: Player, ev: GameEvent[]): void {
  const front = faceStep(playerCell(p), p.face);
  const vx = faceDcol(p.face) * P_SPEED, vy = faceDlin(p.face) * P_SPEED;
  if (p.punch) punchBomb(s, p, ev);
  for (const q of s.players) {
    if (q === p || q.mount || !standing(q) || airborne(q) || isImmune(s, q) || playerCell(q) !== front) continue;
    q.push = { vx, vy, left: P_PUSH_TICKS };
    setAct(s, q, 'pushed', P_PUSH_TICKS);
  }
  // avanço de 16 px (4 px/tick × 4) como movimento forçado; contra casa sólida à frente não sai do lugar
  if (!solid(s.grid[front] ?? CODE.HARD)) p.push = { vx, vy, left: P_ADVANCE_TICKS };
  setAct(s, p, 'pPunch', P_TICKS);
  ev.push({ type: 'p_punch', slot: p.slot });
}

/** Luva: arremessa o que está na mão (jogador ou bomba). */
function throwAny(s: RoundState, p: Player, ev: GameEvent[]): void { if (p.grab >= 0) throwGrab(s, p, ev); else throwHeld(s, p, ev); }
/** Luva: larga o que está na mão 1 casa à frente. */
function tossAny(s: RoundState, p: Player): void { if (p.grab >= 0) tossGrab(s, p); else tossHeld(s, p); }
/** Luva, A: pega o jogador da mesma casa; senão levanta a bomba. (O B só levanta bomba.) */
const liftAny = (s: RoundState, p: Player, ev: GameEvent[]): boolean => tryGrab(s, p, ev) || startLift(s, p, ev);

/** Botões de um jogador num tick (ordem da decisão 20). */
export function playerActions(s: RoundState, p: Player, btn: number, pressed: number, released: number, ev: GameEvent[]): void {
  if (grabbedInput(s, p, pressed)) return;   // na mão de alguém (B para se soltar) ou voando
  if (released & BTN.A && holding(p) && !p.mount) {
    if (p.act === 'lift' && p.actLeft > 0) p.throwQueued = true;
    else { throwAny(s, p, ev); return; }
  }
  if (tickAct(s, p, ev)) return;
  if (MOUNTS.current.drive?.(s, p, ev)) return;   // investida do tipo 4
  // 1º tick livre depois do levantamento ($C2:3692 → normal): a ROM olha o A *apertado* — soltou durante a pose e não
  // apertou de novo, arremessa agora; apertou de novo, continua segurando.
  if (p.throwQueued && holding(p)) {
    p.throwQueued = false;
    if (!(btn & BTN.A)) { throwAny(s, p, ev); return; }
  }
  if (holding(p) && !(btn & (BTN.A | BTN.B))) { tossAny(s, p); setAct(s, p, 'idle'); }   // levantou com B e soltou
  // Trancar: B segurado (depois do tick em que foi apertado) trava o jogador na pose de detonar; assim a luva não o pega.
  if (btn & BTN.B && !(pressed & BTN.B) && !holding(p) && !p.mount) { p.moveDir = 8; setAct(s, p, 'detonate'); return; }
  movePlayer(s, p, btn, ev);
  // Montado (qualquer fase): nada de luva, soco nem P — só o poder da própria montaria (Y) e as bombas.
  const onFoot = !p.mount;
  // Chute só andando contra a bomba (direcional apertado); parado olhando para ela, o Y do soco ainda a alcança.
  // No mesmo tick, Y com Soco vence o chute. Montado, a ROM ($C2:141C) roda o soco do tipo 9 ($C2:48E1) e o Y por tipo
  // ($C2:4625) antes do chute ($C2:4307); os tipos 9, 4 e D saem com SEC e o chute não acontece neste tick.
  const punching = pressed & BTN.Y && (onFoot ? p.punch : !!MOUNTS.current.yEndsTick?.(p));
  if (btn & DIR_BTNS && !punching) tryKick(s, p, ev);
  if (pressed & BTN.A) { if (!holding(p) && !(onFoot && p.glove && liftAny(s, p, ev))) placeBomb(s, p, ev); }
  else if (p.disease === DISEASE.DIARRHEA && !holding(p)) placeBomb(s, p, ev);
  if (pressed & BTN.B && holding(p)) {   // luva: B larga a bomba (ou o jogador) na casa da frente
    tossAny(s, p);
    setAct(s, p, 'detonate', 1);   // pose do B ($C2:36CA) no tick do aperto; parado em T+1, anda em T+2 (B segurado: tranca)
  } else if (pressed & BTN.B && !(onFoot && startLift(s, p, ev))) {   // luva sobre a bomba: B também levanta (segura enquanto apertado)
    detonateRemote(s, p, ev); setAct(s, p, 'detonate', DETONATE_TICKS);
  }
  // X (parar o chute) não é ação do jogador: o deslize da bomba lê o X segurado do dono (kick.ts, `ownerHoldsX`).
  // Tecla própria do P (extra): com ela o P sai só no POWER e o Y fica só com o soco; sem ela, Y faz os dois (ROM).
  const ownP = s.rules.powerKey?.[p.slot] ?? false;
  if (ownP && pressed & BTN.POWER && onFoot && p.pItem) startPPunch(s, p, ev);
  if (pressed & BTN.Y && !MOUNTS.current.onY(s, p, ev) && onFoot) {
    if (p.pItem && !ownP) startPPunch(s, p, ev);
    else if (p.punch) punchBomb(s, p, ev);
  }
}
