// Ações da IA além de andar e soltar bomba (§9.3): B, X, Y (montaria, golpe P, soco) e luva. Cada uma só quando a
// fuga continua garantida pelo mapa de perigo (testada numa cópia da rodada com a ação já feita).
import { BTN, CODE, type Bomb, type Player, type RoundState } from '../types';
import { DETONATE_TICKS, FUSE, LIFT_TICKS, P_TICKS, PUNCH_TICKS, THROW_TICKS } from '../constants';
import { cellAt, cellCenter, colOf, faceStep, inField, linOf } from '../units';
import { playerCell, standing } from '../state';
import { bombAt } from '../bombs';
import { stopKick } from '../kick';
import { aimThrow, handFrom } from '../flyers';
import { MOUNTS } from '../mounts';
import { SAFE, crossCells, firstLanding, hazards, kickPath, type Hazard } from './danger';
import { enterTicks, escape, hasRefuge, ticksPerCell, walkBlocked } from './nav';
import { fork, survives } from './whatif';
import { oldestRemote, type Brain } from './brain';
import type { AiLevel } from './level';

/** Casa que bloqueia o avanço do P e o empurrão (bit $8000: parede, pilar, soft, bomba, queimando, pressão). */
const solid = (v: number): boolean => (v & 0x8000) !== 0;
/** Luva: segura a bomba no máximo este tempo esperando a mira confirmar um alvo; depois arremessa assim mesmo. */
const HOLD_MAX = 16;
/** Luva: só levanta a própria bomba colocada há no máximo este tempo ("recém-colocada"). */
const FRESH = 30;
/** B: a rota da CPU nestes próximos ticks não pode cruzar a explosão. */
const ROUTE_HORIZON = 25;
/** P: o destino do empurrão precisa ficar mortal em até este tempo. */
const P_LETHAL = 30;

/** `q` é adversário de `p` (de pé, outro slot, e de outro time no modo `team`)? */
export function isFoe(s: RoundState, p: Player, q: Player): boolean {
  return q !== p && standing(q) && !(s.rules.mode === 'team' && q.team === p.team);
}
const isMate = (s: RoundState, p: Player, q: Player): boolean =>
  q !== p && standing(q) && s.rules.mode === 'team' && q.team === p.team;

/** Alguém de pé (nós, colega ou adversário) nas casas `cells`? */
function who(s: RoundState, p: Player, cells: ReadonlySet<number>): { foe: boolean; ours: boolean } {
  let foe = false, ours = false;
  for (const q of s.players) {
    if (!standing(q) || !cells.has(playerCell(q))) continue;
    if (q === p || isMate(s, p, q)) ours = true; else foe = true;
  }
  return { foe, ours };
}

/** Põe a bomba `id` da cópia `sim` no ar com o voo `flight`, saindo de `from`. */
function launch(sim: RoundState, id: number, flight: `throw${2 | 3 | 4 | 5}` | 'punch', dir: 0 | 1 | 2 | 3,
  from: { x: number; y: number; z: number }): void {
  const b = sim.bombs.find(x => x.id === id);
  if (!b) return;
  if (b.state === 'idle' && sim.grid[b.cell] === CODE.BOMB) sim.grid[b.cell] = CODE.FLOOR;
  b.state = 'air';
  sim.flyers.push({ id: -1, kind: 'bomb', ref: id, x: from.x, y: from.y, z: from.z, dir, flight, script: 0, i: 0, born: sim.tick });
}

/** Casas onde a CPU vai estar nos próximos `horizon` ticks seguindo o caminho planejado. */
function routeCells(s: RoundState, p: Player, brain: Brain, horizon: number): number[] {
  const here = playerCell(p);
  const out = [here];
  const half = Math.ceil(ticksPerCell(s, p) * 9 / 16);
  for (let k = 0; k < brain.path.length; k++) {
    const c = brain.path[k];
    if (c === here) continue;
    const start = Math.max(0, (brain.go[k] ?? s.tick) - s.tick);
    const enter = k === 0 ? start + enterTicks(s, p, c) : start + half;
    if (enter >= horizon) break;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- B

/** B: a remota mais antiga (a que o B detona) pega um adversário e não pega a CPU, um colega nem a rota da CPU; ou o
 *  pavio dela já teria acabado (126 ticks) e ninguém do nosso lado está na cruz. */
function wantB(s: RoundState, p: Player, level: AiLevel, brain: Brain): boolean {
  const b = oldestRemote(s, p);
  if (!b) return false;
  const c = b.state === 'kicked' ? cellAt(b.x, b.y) : b.cell;
  if (c < 0) return false;
  const cross = new Set(crossCells(s, c, b.fire, false).cells);
  const w = who(s, p, cross);
  if (w.ours || !(w.foe || (s.tick >= b.born + FUSE && b.state === 'idle'))) return false;
  if (routeCells(s, p, brain, ROUTE_HORIZON).some(i => cross.has(i))) return false;
  const sim = fork(s);
  const sb = sim.bombs.find(x => x.id === b.id)!;
  sb.chainAt = s.tick + 1;
  return survives(sim, p.slot, level, DETONATE_TICKS);
}

// ---------------------------------------------------------------------------------------------------------------- X

/** X: uma bomba chutada pela CPU, parada agora, pegaria um adversário (e não a CPU nem um colega). */
function wantX(s: RoundState, p: Player, level: AiLevel): boolean {
  const mine = s.bombs.filter(b => b.state === 'kicked' && b.kickedBy === p.slot);
  if (!mine.some(b => {
    const c = cellAt(b.x, b.y);
    if (c < 0) return false;
    const w = who(s, p, new Set(crossCells(s, c, b.fire, b.type === 2).cells));
    return w.foe && !w.ours;
  })) return false;
  const sim = fork(s);                                     // o X para todas as bombas chutadas pela CPU
  stopKick(sim, sim.players[p.slot]);
  return survives(sim, p.slot, level, 0);
}

// ---------------------------------------------------------------------------------------------------------------- Y

/** Cópia da rodada depois de um Y de `p` (golpe P ou soco) e o tempo que ele fica travado. */
function afterY(s: RoundState, p: Player): { sim: RoundState; delay: number } {
  const sim = fork(s);
  const here = playerCell(p), front = faceStep(here, p.face), dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  const b = p.punch ? bombAt(s, front) : undefined;
  if (b) { const [x, y] = cellCenter(front); launch(sim, b.id, 'punch', dir, { x, y, z: 0 }); }
  if (!p.pItem) return { sim, delay: PUNCH_TICKS };
  for (const q of sim.players) {                           // empurrados 3 casas, parando antes de sólido
    if (q.slot === p.slot || !standing(q) || playerCell(q) !== front) continue;
    let c = front;
    for (let k = 0; k < 3; k++) { const n = faceStep(c, p.face); if (solid(sim.grid[n] ?? CODE.HARD)) break; c = n; }
    [q.x, q.y] = cellCenter(c);
  }
  if (!solid(sim.grid[front] ?? CODE.HARD)) [sim.players[p.slot].x, sim.players[p.slot].y] = cellCenter(front);
  return { sim, delay: P_TICKS };
}

/** Soco: bomba parada na casa da frente e, no 1º pouso (3 casas adiante, com a volta pela borda), um adversário de pé;
 *  ou, sem fuga garantida agora, o soco abre a fuga. */
function wantPunch(s: RoundState, p: Player, level: AiLevel, hz: Hazard): boolean {
  if (!p.punch || p.mount) return false;
  const here = playerCell(p), front = faceStep(here, p.face);
  if (!bombAt(s, front)) return false;
  const [x, y] = cellCenter(front);
  const land = firstLanding(x, y, (p.face >> 1) as 0 | 1 | 2 | 3, 'punch');
  const onFoe = s.players.some(q => isFoe(s, p, q) && playerCell(q) === land);
  if (!onFoe && (hz.at[here] === SAFE || escape(s, p, hz, walkBlocked(s, p), level, true, 0) !== null)) return false;
  const { sim, delay } = afterY(s, p);
  return survives(sim, p.slot, level, delay);
}

/** Golpe P: adversário na casa da frente e o caminho do empurrão (até 3 casas, parando antes de sólido) fica mortal
 *  enquanto ele passa ou em até 30 ticks no destino (chama prevista ou pressão). */
function wantP(s: RoundState, p: Player, level: AiLevel): boolean {
  if (!p.pItem || p.mount) return false;
  const front = faceStep(playerCell(p), p.face);
  const victims = s.players.filter(q => q !== p && standing(q) && playerCell(q) === front);
  if (!victims.length || victims.some(q => !isFoe(s, p, q))) return false;
  const hz = hazards(s, victims[0].slot);
  let c = front, lethal = false;
  for (let k = 1; k <= 3 && !lethal; k++) {
    const n = faceStep(c, p.face);
    if (!inField(colOf(n), linOf(n)) || solid(s.grid[n])) break;
    c = n;
    const last = k === 3 || solid(s.grid[faceStep(c, p.face)] ?? CODE.HARD);
    const from = 4 * (k - 1), to = last ? P_LETHAL : 4 * k + 4;
    lethal = hz.at[c] <= to && (hz.end[c] === SAFE || hz.end[c] > from);
  }
  if (!lethal) return false;
  const { sim, delay } = afterY(s, p);
  return survives(sim, p.slot, level, delay);
}

// ------------------------------------------------------------------------------------------------------------- luva

/** Luva (A de novo sobre a bomba recém-colocada, segura e solta mirando). null = a luva não decide neste tick. */
function glove(s: RoundState, p: Player, level: AiLevel, brain: Brain, last: number): number | null {
  const here = playerCell(p);
  if (p.carry >= 0) {
    brain.still = true;
    if (brain.liftAt < 0) brain.liftAt = s.tick - LIFT_TICKS;           // levantou sem planejar: arremessa logo
    if (!(last & BTN.A)) return BTN.A;                                  // (soltar só arremessa se A estava apertado)
    const held = s.tick - brain.liftAt;
    if (p.act === 'lift' || held < LIFT_TICKS) return BTN.A;
    if (aimThrow(s, here, p.face, p.slot) > 4 && held < HOLD_MAX) return BTN.A;
    brain.liftAt = -1;
    return 0;                                                           // solta A: arremessa
  }
  if (brain.liftAt >= 0) {
    if (s.tick <= brain.liftAt + 1) { brain.still = true; return BTN.A; }
    brain.liftAt = -1;
  }
  if (!p.glove || p.mount || p.actLeft > 0) return null;
  const b = bombAt(s, here);
  if (!b || b.owner !== p.slot || b.bad || s.tick - b.born > FRESH) return null;
  const n = aimThrow(s, here, p.face, p.slot);
  if (n > 4) return null;
  const target = s.players.find(q => q.slot !== p.slot && standing(q) && playerCell(q) === stepN(here, p.face, n));
  if (!target || !isFoe(s, p, target)) return null;
  const sim = fork(s);
  const dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  const [x, y] = cellCenter(here);
  launch(sim, b.id, `throw${n}`, dir, handFrom(x, y, dir));
  if (!survives(sim, p.slot, level, 2 + LIFT_TICKS + THROW_TICKS)) return null;
  brain.still = true;
  if (last & BTN.A) return 0;                                           // solta antes: o levantar precisa de borda
  brain.liftAt = s.tick;
  return BTN.A;
}

function stepN(cell: number, face: number, n: number): number {
  for (let k = 0; k < n; k++) cell = faceStep(cell, face);
  return cell;
}

// ------------------------------------------------------------------------------------------------------------ chute

/** Para que serve um chute: `rescue` = só abrir a fuga; `hit` = alguma casa do trajeto (onde o X pode parar a bomba)
 *  pega um adversário; `trap` = a bomba chutada deixa um adversário perto sem refúgio. */
export type KickAim = 'rescue' | 'hit' | 'trap';

/** Chutar (a partir de `from`, padrão a casa atual) a bomba parada na vizinha `face` serve para `aim` e a fuga continua
 *  garantida? */
export function kickWorth(s: RoundState, p: Player, face: number, level: AiLevel, aim: KickAim,
  from = playerCell(p)): boolean {
  if (!((p.kick && !p.mount) || MOUNTS.current.kicks?.(p))) return false;
  const n = faceStep(from, face);
  if (s.grid[n] !== CODE.BOMB) return false;
  const b = bombAt(s, n);
  if (!b || b.fuse <= 1 || b.chainAt) return false;
  const sim = fork(s);
  const sb = sim.bombs.find(x => x.id === b.id)!;
  sb.state = 'kicked'; sb.dir = face as Bomb['dir']; sb.step = 0; sb.kickedBy = p.slot; sb.turn = -1;
  sim.grid[n] = CODE.FLOOR;
  if (from !== playerCell(p)) [sim.players[p.slot].x, sim.players[p.slot].y] = cellCenter(from);
  const kp = kickPath(sim, sb);
  if (kp.trail.length < 2) return false;                                // parada: não sai do lugar
  if (aim === 'hit' && !kp.trail.slice(1).some(c => {
    const w = who(s, p, new Set(crossCells(s, c, b.fire, b.type === 2).cells));
    return w.foe && !w.ours;
  })) return false;
  if (aim === 'trap' && !sim.players.some(q => {
    if (!isFoe(sim, sim.players[p.slot], q)) return false;
    const qc = playerCell(q);
    if (Math.abs(colOf(qc) - colOf(kp.cell)) + Math.abs(linOf(qc) - linOf(kp.cell)) > 6) return false;
    return !hasRefuge(sim, q, hazards(sim, q.slot), walkBlocked(sim, q));
  })) return false;
  return survives(sim, p.slot, level, 1);
}

// ------------------------------------------------------------------------------------------------------------ geral

/**
 * Botões de ação deste tick (somados à direção do `steer`), na ordem B → X → Y (montaria, P, soco) → luva; no máximo
 * um por tick, sempre como borda. Liga `brain.still` quando a ação precisa da CPU parada (mira e face atuais).
 */
export function decideActions(s: RoundState, p: Player, level: AiLevel, brain: Brain, ai: { lastOut: number[] }): number {
  brain.still = false;
  const last = ai.lastOut[p.slot] ?? 0;
  const g = glove(s, p, level, brain, last);
  if (g !== null) return g;
  if (p.actLeft > 0) return 0;
  if (!(last & BTN.B) && wantB(s, p, level, brain)) return BTN.B;
  if (!(last & BTN.X) && wantX(s, p, level)) return BTN.X;
  if (!(last & BTN.Y)) {
    if (MOUNTS.current.ai?.useY?.(s, p.slot)) return BTN.Y;
    const front = faceStep(playerCell(p), p.face);
    const punchable = p.punch && !p.mount && !!bombAt(s, front);
    if (wantP(s, p, level) || (punchable && wantPunch(s, p, level, hazards(s, p.slot)))) { brain.still = true; return BTN.Y; }
  }
  return 0;
}
