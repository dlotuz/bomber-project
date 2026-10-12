// Ações da IA além de andar e soltar bomba (§9.3): B, X, Y (montaria, golpe P, soco) e luva. Cada uma só quando a
// fuga continua garantida pelo mapa de perigo (testada numa cópia da rodada com a ação já feita).
import { BTN, CODE, type Bomb, type Flyer, type Player, type RoundState } from '../types';
import { CHAIN_DELAY, DETONATE_TICKS, FUSE, FUSE_LONG, LIFT_TICKS, P_TICKS, PUNCH_TICKS, STUN_TICKS, THROW_TICKS } from '../constants';
import { cellAt, cellCenter, colOf, faceStep, inField, linOf } from '../units';
import { playerCell, standing } from '../state';
import { bombAt, bombById, bombOccupies } from '../bombs';
import { canKick, kickable, stopKick } from '../kick';
import { aimThrow, handFrom } from '../flyers';
import { MOUNTS } from '../mounts';
import { SAFE, crossCells, firstLanding, flightEnd, hazards, kickPath, type Hazard } from './danger';
import { centered, enterTicks, escape, hasRefuge, ticksPerCell, walkBlocked } from './nav';
import { fork, survives } from './whatif';
import { oldestRemote, type Brain } from './brain';
import { aiRoll, type AiLevel } from './level';
import { isImmune } from '../hit';
import { airborne } from '../grab';

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
/** Luva: segurando uma bomba "carregada" (pavio no ponto de matar), espera até este tempo alguém entrar na mira. */
const HOLD_LOADED = 90;
/** Luva: sem alvo na linha, carrega a bomba (espera o pavio baixar sobre ela) se houver adversário a até tantas casas. */
const LOAD_NEAR = 5;
/** Folga (ticks) depois do fim do atordoamento: quem acorda ainda leva uns ticks para sair da casa. */
const KILL_SLACK = 2;
/** Luva: pavio de uma bomba "carregada" — atordoando com ela, o quique de ~8 ticks ainda explode antes de ele acordar. */
const LOADED_FUSE = STUN_TICKS + KILL_SLACK - 10;
/** Direcional de cada face (0 ↑, 2 →, 4 ↓, 6 ←). */
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];
const FACES: readonly number[] = [0, 2, 4, 6];

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
function launch(sim: RoundState, id: number, flight: `throw${2 | 3 | 4 | 5}` | 'punch' | 'bounce', dir: 0 | 1 | 2 | 3,
  from: { x: number; y: number; z: number }): void {
  const b = sim.bombs.find(x => x.id === id);
  if (!b) return;
  if (b.state === 'idle' && sim.grid[b.cell] === CODE.BOMB) sim.grid[b.cell] = CODE.FLOOR;
  b.state = 'air';
  sim.flyers.push({ id: -1, kind: 'bomb', ref: id, x: from.x, y: from.y, z: from.z, dir, flight, script: 0, i: 0, born: sim.tick });
}

// ------------------------------------------------------------------------------------------- bomba na cabeça
// Bomba que cai em cima de alguém (soco ou luva) o atordoa por STUN_TICKS e quica 1 casa adiante ($C1:280B → $C1:294D).
// No ar e na mão o pavio fica parado, então o pavio ao cair é o de quando ela saiu: se for curto, a explosão do pouso
// do quique pega o atordoado antes de ele acordar. Medido no núcleo (CPU forte fugindo ao acordar): mata com pavio até
// ~60; com 126 ele sempre escapa.

/** Maior pavio com que a bomba `b` caindo na casa `land` (vinda na direção `dir`) mata quem ela atordoa ali: −1 = não
 *  atordoa um adversário (casa vazia, colega, invencível, já atordoado, sobre bomba/bloco) ou o quique sai da cruz. */
export function killFuse(s: RoundState, p: Player, b: Bomb, land: number, dir: 0 | 1 | 2 | 3): number {
  if (land < 0 || !inField(colOf(land), linOf(land))) return -1;
  if ((s.grid[land] & 0x0800) !== 0 || bombOccupies(s, land, b)) return -1;   // quica antes do teste de jogador ($C1:27A4)
  const there = s.players.filter(q => standing(q) && q.heldBy < 0 && !q.flying && q.act !== 'dropped' && playerCell(q) === land);
  if (!there.length || there.some(q => !isFoe(s, p, q))) return -1;
  if (!there.some(q => q.act !== 'stunned' && q.inv <= 0)) return -1;            // $C2:59D6: invencível não é atordoado
  const [x, y] = cellCenter(land);
  const f: Flyer = { id: -1, kind: 'bomb', ref: b.id, x, y, z: 0, dir, flight: 'bounce', script: 0, i: 0, born: s.tick };
  const e = flightEnd(s, f);
  if (e.cell < 0) return -1;
  if (!crossCells(s, e.cell, b.fire, b.type === 2, undefined, true, b.level ?? 0).cells.includes(land)) return -1;
  const limit = STUN_TICKS + KILL_SLACK - e.t - 2;                                // a chama chega no offset e.t + pavio + 2
  if (s.grid[e.cell] === CODE.FLAME) return e.t + CHAIN_DELAY + 1 <= STUN_TICKS + KILL_SLACK ? FUSE_LONG : -1;
  if (b.type === 1) return b.owner === p.slot && !b.bad ? FUSE_LONG : -1;          // remota: só a nossa (o B detona)
  return limit;
}

/** Maior pavio com que um arremesso da luva de `p` (da casa atual, olhando para `face`) mata; −1 = não mata. */
function throwKill(s: RoundState, p: Player, b: Bomb, face: number): number {
  const here = playerCell(p);
  const n = aimThrow(s, here, face, p.slot);
  return n > 4 ? -1 : killFuse(s, p, b, stepN(here, face, n), (face >> 1) as 0 | 1 | 2 | 3);
}

/** Maior pavio com que o soco da bomba `b` na direção `face` mata; −1 = não mata. */
export function punchKill(s: RoundState, p: Player, b: Bomb, face: number): number {
  const [x, y] = cellCenter(b.cell);
  const dir = (face >> 1) as 0 | 1 | 2 | 3;
  return killFuse(s, p, b, firstLanding(x, y, dir, 'punch'), dir);
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
  const cross = new Set(crossCells(s, c, b.fire, false, undefined, true, b.level ?? 0).cells);
  const w = who(s, p, cross);
  if (w.ours || !(w.foe || (s.tick >= b.born + FUSE && b.state === 'idle'))) return false;
  if (routeCells(s, p, brain, ROUTE_HORIZON).some(i => cross.has(i))) return false;
  const sim = fork(s);
  const sb = sim.bombs.find(x => x.id === b.id)!;
  sb.chainAt = s.tick + 1;
  return survives(sim, p.slot, level, DETONATE_TICKS);
}

// ---------------------------------------------------------------------------------------------------------------- X

/** X: uma bomba da CPU que ela mesma chutou, rolando e parada agora, pegaria um adversário (e não a CPU nem um
 *  colega). O X vale para todas as bombas do dono que rolam ($C1:38CE), então a CPU não aperta X enquanto rola uma bomba
 *  dela chutada por outro: a CPU original nunca aperta X (emulador, ajstop2/cpux.py: 30 000 quadros só de CPUs com
 *  Chute, 14 chutes, +$30 bit $0040 nunca ligado) e parar o chute alheio era a parada "sem motivo" que o jogador via. */
function wantX(s: RoundState, p: Player, level: AiLevel): boolean {
  const mine = s.bombs.filter(b => b.state === 'kicked' && b.owner === p.slot);
  if (mine.some(b => b.kickedBy !== p.slot)) return false;
  if (!mine.some(b => {
    const c = cellAt(b.x, b.y);
    if (c < 0) return false;
    const w = who(s, p, new Set(crossCells(s, c, b.fire, b.type === 2, undefined, true, b.level ?? 0).cells));
    return w.foe && !w.ours;
  })) return false;
  const sim = fork(s);                                     // o X para todas as bombas da CPU que estão rolando
  stopKick(sim, sim.players[p.slot]);
  return survives(sim, p.slot, level, 0);
}

// ---------------------------------------------------------------------------------------------------------------- Y

/** Cópia da rodada depois de um Y de `p` (golpe P ou soco) e o tempo que ele fica travado. `face`: olhando para lá
 *  (padrão a face atual); `fuse`: pavio da bomba socada (padrão o atual; serve para testar o soco mais tarde);
 *  `punchOnly`: só o soco, mesmo com o P (tecla própria do P). */
function afterY(s: RoundState, p: Player, face: number = p.face, fuse?: number, punchOnly = false): { sim: RoundState; delay: number } {
  const sim = fork(s);
  const here = playerCell(p), front = faceStep(here, face), dir = (face >> 1) as 0 | 1 | 2 | 3;
  sim.players[p.slot].face = face as Player['face'];
  const b = p.punch ? bombAt(s, front) : undefined;
  if (b) {
    if (fuse !== undefined) sim.bombs.find(x => x.id === b.id)!.fuse = fuse;
    const [x, y] = cellCenter(front); launch(sim, b.id, 'punch', dir, { x, y, z: 0 });
  }
  if (!p.pItem || punchOnly) return { sim, delay: PUNCH_TICKS };
  for (const q of sim.players) {                           // empurrados 3 casas, parando antes de sólido
    if (q.slot === p.slot || q.mount || !standing(q) || playerCell(q) !== front) continue;   // montado: o P não acha
    let c = front;
    for (let k = 0; k < 3; k++) { const n = faceStep(c, p.face); if (solid(sim.grid[n] ?? CODE.HARD)) break; c = n; }
    [q.x, q.y] = cellCenter(c);
  }
  if (!solid(sim.grid[front] ?? CODE.HARD)) [sim.players[p.slot].x, sim.players[p.slot].y] = cellCenter(front);
  return { sim, delay: P_TICKS };
}

/** Soco, por ordem: (1) bomba vizinha com pavio no ponto ($killFuse) e um adversário no 1º pouso (3 casas adiante,
 *  com a volta pela borda): soca, ou vira para ela se estiver de lado; (2) o mesmo com pavio ainda longo: fica parado
 *  olhando para ela até o pavio baixar, enquanto der para desistir e fugir e o soco de então for seguro; (3) adversário
 *  no pouso sem dar para esperar: soca assim mesmo (só atordoa); (4) sem fuga garantida agora, o soco abre a fuga.
 *  Devolve os botões (Y, direcional para virar, 0 = esperar parado) ou null (o soco não decide neste tick). */
function punchPlan(s: RoundState, p: Player, level: AiLevel, hz: Hazard): number | null {
  if (!p.punch || p.mount || (p.pItem && !s.rules.powerKey?.[p.slot])) return null;   // com P (sem tecla própria) o Y é o P
  const here = playerCell(p);
  // virar: só sem Chute (apertar contra a bomba chutaria) e centrado (o direcional não tira da casa)
  const turns = !canKick(p) && centered(s, p);
  const go = (face: number): number => (face === p.face ? BTN.Y : FACE_BTN[face]);
  let wait = -1, stun = -1;
  for (const face of [p.face, ...FACES.filter(f => f !== p.face)]) {
    if (face !== p.face && !turns) continue;
    const b = bombAt(s, faceStep(here, face));
    if (!b || b.bad) continue;
    const kf = punchKill(s, p, b, face);
    if (kf >= 0 && b.fuse <= kf) { if (survives(afterY(s, p, face, undefined, true).sim, p.slot, level, PUNCH_TICKS)) return go(face); continue; }
    if (kf >= 0 && wait < 0 && !b.chainAt && escape(s, p, hz, walkBlocked(s, p), level, true, b.fuse - kf) !== null
      && survives(afterY(s, p, face, kf, true).sim, p.slot, level, PUNCH_TICKS)) wait = face;
    if (stun < 0) {
      const [x, y] = cellCenter(b.cell);
      const land = firstLanding(x, y, (face >> 1) as 0 | 1 | 2 | 3, 'punch');
      if (s.players.some(q => isFoe(s, p, q) && playerCell(q) === land)) stun = face;
    }
  }
  if (wait >= 0) return wait === p.face ? 0 : FACE_BTN[wait];
  if (stun >= 0 && survives(afterY(s, p, stun, undefined, true).sim, p.slot, level, PUNCH_TICKS)) return go(stun);
  // sem matar nem atordoar: o soco manda a bomba para onde o adversário fica sem refúgio (só às vezes, por bomba)
  if (level.hunt) {
    for (const face of [p.face, ...FACES.filter(f => f !== p.face)]) {
      if (face !== p.face && !turns) continue;
      const b = bombAt(s, faceStep(here, face));
      if (!b || b.bad || b.chainAt || aiRoll(b.id, p.slot, 15, 0) >= trapChance(level)) continue;
      const [x, y] = cellCenter(b.cell);
      if (trapsFoeAt(s, p, b, firstLanding(x, y, (face >> 1) as 0 | 1 | 2 | 3, 'punch'))
        && survives(afterY(s, p, face, undefined, true).sim, p.slot, level, PUNCH_TICKS)) return go(face);
    }
  }
  if (!bombAt(s, faceStep(here, p.face)) || hz.at[here] === SAFE || escape(s, p, hz, walkBlocked(s, p), level, true, 0) !== null) return null;
  return survives(afterY(s, p, p.face, undefined, true).sim, p.slot, level, PUNCH_TICKS) ? BTN.Y : null;
}

/** Golpe P: adversário na casa da frente e o caminho do empurrão (até 3 casas, parando antes de sólido) fica mortal
 *  enquanto ele passa ou em até 30 ticks no destino (chama prevista ou pressão). */
function wantP(s: RoundState, p: Player, level: AiLevel): boolean {
  if (!p.pItem || p.mount) return false;
  const front = faceStep(playerCell(p), p.face);
  const victims = s.players.filter(q => q !== p && !q.mount && standing(q) && playerCell(q) === front);   // como startPPunch
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

// ------------------------------------------------------------------------------------------------------------- ameaças

/**
 * Ameaça de atordoamento/reflect em cima de `p`: uma bomba no ar que vai pousar na casa dele em pouco tempo, ou um
 * adversário de luva com uma bomba na mão olhando para ele (colado: o B larga na cabeça; na linha a até 4 casas: o
 * arremesso mira nele). `avoid` = casas a evitar ao desviar (pouso, ou a linha de tiro); `key` = identifica a ameaça
 * (para sortear "desvia ou não" uma vez só por ameaça, não a cada decisão).
 */
export function incomingStun(s: RoundState, p: Player): { avoid: ReadonlySet<number>; key: number } | null {
  const here = playerCell(p);
  if (here < 0) return null;
  for (const f of s.flyers) {
    if (f.kind !== 'bomb') continue;
    const e = flightEnd(s, f);
    if (e.cell === here && e.t <= 36) return { avoid: new Set([here]), key: 100 + f.id };
  }
  for (const q of s.players) {
    if (!isFoe(s, p, q) || q.carry < 0 || airborne(q)) continue;
    const line: number[] = [];
    let c = playerCell(q), hit = false;
    for (let k = 1; k <= 4; k++) {
      c = faceStep(c, q.face);
      if (!inField(colOf(c), linOf(c))) break;
      line.push(c);
      if (k === 1 && c === here) hit = true;                       // B: larga a bomba na casa da frente
      if (k >= 2 && s.players.some(o => o !== q && standing(o) && o.heldBy < 0 && !o.flying && playerCell(o) === c)) {
        if (c === here) hit = true;                                // arremesso: cai no 1º jogador da linha (2..4)
        break;
      }
    }
    if (hit) return { avoid: new Set(line), key: 200 + q.slot * 64 + (q.carry & 63) };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------------------- luva

/** Arremessar a bomba `b` da casa atual olhando para `face` deixa a CPU com fuga garantida (travada `delay` ticks)? */
function throwSafe(s: RoundState, p: Player, b: Bomb, level: AiLevel, face: number, delay: number): boolean {
  const here = playerCell(p);
  const sim = fork(s);
  sim.players[p.slot].face = face as Player['face'];
  const n = aimThrow(sim, here, face, p.slot);
  const dir = (face >> 1) as 0 | 1 | 2 | 3;
  const [x, y] = cellCenter(here);
  launch(sim, b.id, `throw${n}`, dir, handFrom(x, y, dir));
  return survives(sim, p.slot, level, delay);
}

/** Algum adversário a até `d` casas (Manhattan) de `cell`? */
function foeNear(s: RoundState, p: Player, cell: number, d: number): boolean {
  return s.players.some(q => isFoe(s, p, q) && Math.abs(colOf(playerCell(q)) - colOf(cell)) + Math.abs(linOf(playerCell(q)) - linOf(cell)) <= d);
}

/** A bomba `b`, pousando em `land` (casa livre, sem jogador), deixaria um adversário perto sem refúgio — encurralado — e
 *  não pegaria colega nenhum? (Sem matar agora: serve só para prender; o resto é com a explosão.) */
export function trapsFoeAt(s: RoundState, p: Player, b: Bomb, land: number): boolean {
  if (land < 0 || !inField(colOf(land), linOf(land)) || s.grid[land] !== CODE.FLOOR || bombOccupies(s, land, b)) return false;
  if (s.players.some(q => standing(q) && playerCell(q) === land)) return false;
  const sim = fork(s);
  const sb = sim.bombs.find(x => x.id === b.id);
  if (!sb) return false;
  if (sb.state === 'idle' && sim.grid[sb.cell] === CODE.BOMB) sim.grid[sb.cell] = CODE.FLOOR;
  sb.state = 'idle'; sb.cell = land; [sb.x, sb.y] = cellCenter(land); sim.grid[land] = CODE.BOMB;
  const me = sim.players[p.slot];
  const arm = new Set(crossCells(sim, land, b.fire, b.type === 2, undefined, true, b.level ?? 0).cells);
  if (sim.players.some(q => q !== me && isMate(sim, me, q) && arm.has(playerCell(q)))) return false;
  return sim.players.some(q => {
    if (!isFoe(sim, me, q)) return false;
    const qc = playerCell(q);
    if (Math.abs(colOf(qc) - colOf(land)) + Math.abs(linOf(qc) - linOf(land)) > 6) return false;
    const was = s.players[q.slot];
    const hadRefuge = hasRefuge(s, was, hazards(s, was.slot), walkBlocked(s, was));
    return hadRefuge && !hasRefuge(sim, q, hazards(sim, q.slot), walkBlocked(sim, q));
  });
}

/** Arremesso da luva de `p` olhando para `face` deixa a bomba `b` numa casa que encurrala um adversário. */
function throwTrap(s: RoundState, p: Player, b: Bomb, face: number): boolean {
  const here = playerCell(p);
  const n = aimThrow(s, here, face, p.slot);
  return trapsFoeAt(s, p, b, stepN(here, face, n));
}

/** Há um jeito de atordoar um adversário com a bomba `b` (que a luva vai levantar): ele colado na frente, para a
 *  dropadinha, ou o arremesso caindo na cabeça dele. */
function canStunFoe(s: RoundState, p: Player, b: Bomb, turns: boolean): boolean {
  const here = playerCell(p);
  const c = faceStep(here, p.face);
  if (inField(colOf(c), linOf(c))) {
    const v = s.players.find(q => isFoe(s, p, q) && !airborne(q) && !q.mount && q.carry < 0 && playerCell(q) === c);
    if (v && killFuse(s, p, b, c, (p.face >> 1) as 0 | 1 | 2 | 3) >= 0) return true;
  }
  for (const face of [p.face, ...FACES.filter(f => f !== p.face)]) {
    if (face !== p.face && !turns) continue;
    const n = aimThrow(s, here, face, p.slot);
    if (n <= 4 && killFuse(s, p, b, stepN(here, face, n), (face >> 1) as 0 | 1 | 2 | 3) >= 0) return true;
  }
  return false;
}

/** Depois de arremessar/largar, a luva fica sem "oportunidades" por este tempo (ticks). */
const GLOVE_COOL = 240;
/** Chance (%) de usar a luva só para encurralar, por nível. */
const trapChance = (level: AiLevel): number => (level.trap ? 70 : level.hunt ? 30 : 0);

/** Adversário na casa de `p` que a luva consegue pegar (de pé, no chão, sem montaria, sem invencibilidade e sem
 *  estar segurando B para "trancar"); undefined = ninguém. */
function foeToGrab(s: RoundState, p: Player): Player | undefined {
  const here = playerCell(p);
  return s.players.find(q => isFoe(s, p, q) && !airborne(q) && !q.mount && !isImmune(s, q) && !(q.prevBtn & BTN.B) && playerCell(q) === here);
}

/** Segurando um adversário (pego com a luva): arremessa quando a queda dele cai em chama/perigo; sem isso, segura um
 *  pouco e arremessa para longe (ou já, se a casa de quem segura está para explodir). */
function holdFoe(s: RoundState, p: Player, level: AiLevel, brain: Brain, last: number): number {
  const here = playerCell(p);
  const q = s.players[p.grab];
  brain.still = true;
  if (brain.liftAt < 0) brain.liftAt = s.tick - LIFT_TICKS;
  if (!(last & BTN.A)) return BTN.A;
  const held = s.tick - brain.liftAt;
  if (p.act === 'lift' || held < LIFT_TICKS) return BTN.A;
  const release = (): number => { brain.liftAt = -1; brain.cool = s.tick + GLOVE_COOL; return 0; };
  if (!q) return release();
  const turns = centered(s, p);
  const hzFoe = hazards(s, q.slot), hzMe = hazards(s, p.slot);
  let lethal = -1, far = -1, farN = -1;
  for (const face of [p.face, ...FACES.filter(f => f !== p.face)]) {
    if (face !== p.face && !turns) continue;
    const n = aimThrow(s, here, face, p.slot);
    const land = stepN(here, face, n);
    if (!inField(colOf(land), linOf(land)) || (s.grid[land] & 0x8000) !== 0) continue;
    if (lethal < 0 && hzFoe.at[land] !== SAFE && hzFoe.at[land] <= 45) lethal = face;
    if (n > farN) { farN = n; far = face; }
  }
  const pose = (face: number): number => (face === p.face ? release() : FACE_BTN[face] | BTN.A);
  if (lethal >= 0 && survives(s, p.slot, level, THROW_TICKS)) return pose(lethal);
  if ((held >= HOLD_MAX * 2 || hzMe.at[here] !== SAFE) && far >= 0) return pose(far);
  if (held >= HOLD_MAX * 3) return release();
  return BTN.A;
}

/**
 * Luva. Segurando: arremessa na cabeça de quem o pavio mata (vira para ele se estiver de lado); com a bomba carregada
 * (pavio curto, que já não anda na mão), segura até HOLD_LOADED esperando alguém entrar na mira; senão arremessa em
 * quem estiver na linha (só atordoa) ou, passado HOLD_MAX, para um lado seguro.
 * Sobre uma bomba: levanta se o arremesso já mata; com adversário perto e o pavio longo demais, espera parado em cima
 * dela o pavio baixar ("carregar") enquanto der para desistir e fugir; bomba recém-colocada com alguém na mira e sem dar
 * para esperar, levanta e arremessa assim mesmo (como antes). null = a luva não decide neste tick.
 */
function glove(s: RoundState, p: Player, level: AiLevel, brain: Brain, last: number): number | null {
  const here = playerCell(p);
  const turns = centered(s, p);
  const faces = [p.face, ...FACES.filter(f => f !== p.face)];
  const release = (): number => { brain.liftAt = -1; brain.cool = s.tick + GLOVE_COOL; return 0; };      // solta A: arremessa
  const aimAt = (face: number): number => (face === p.face ? release() : FACE_BTN[face] | BTN.A);
  if (p.grab >= 0) return holdFoe(s, p, level, brain, last);
  if (p.carry >= 0) {
    brain.still = true;
    if (brain.liftAt < 0) brain.liftAt = s.tick - LIFT_TICKS;           // levantou sem planejar: arremessa logo
    if (!(last & BTN.A)) return BTN.A;                                  // (soltar só arremessa se A estava apertado)
    const held = s.tick - brain.liftAt;
    if (p.act === 'lift' || held < LIFT_TICKS) return BTN.A;
    const b = bombById(s, p.carry);
    if (!b) return release();
    // morreria esperando (explosão prevista aqui): nada de esperar mira nem pavio
    const unsafe = hazards(s, p.slot).at[here] !== SAFE;
    // dropadinha: B larga a bomba na casa da frente, na cabeça do adversário colado — mata (pavio no ponto) ou só
    // atordoa, conforme a vez; nunca em quem segura bomba (reflete de volta). Sorteio por bomba, não por tick.
    if (!(last & BTN.B)) {
      const c = faceStep(here, p.face);
      const victim = inField(colOf(c), linOf(c))
        ? s.players.find(q => isFoe(s, p, q) && !airborne(q) && playerCell(q) === c) : undefined;
      if (victim && victim.carry < 0 && !victim.mount) {
        const kf = killFuse(s, p, b, c, (p.face >> 1) as 0 | 1 | 2 | 3);
        if (kf >= 0) {
          const chance = b.fuse <= kf ? level.dropKill : level.dropStun;
          if (unsafe || aiRoll(b.id, p.slot, 11, brain.seed) < chance) {
            const sim = fork(s);
            sim.players[p.slot].carry = -1;
            const [x, y] = cellCenter(here);
            launch(sim, b.id, 'bounce', (p.face >> 1) as 0 | 1 | 2 | 3, { x, y, z: 0 });
            if (survives(sim, p.slot, level, DETONATE_TICKS)) { brain.liftAt = -1; brain.cool = s.tick + GLOVE_COOL; return BTN.A | BTN.B; }
          }
        }
      }
    }
    for (const face of faces) {
      if (face !== p.face && !turns) continue;
      if (b.fuse <= throwKill(s, p, b, face) && throwSafe(s, p, b, level, face, THROW_TICKS)) return aimAt(face);
    }
    // sem matar: prende o adversário mandando a bomba para onde ele fica sem refúgio (só às vezes, por bomba)
    if (level.hunt && aiRoll(b.id, p.slot, 15, brain.seed) < trapChance(level)) {
      for (const face of faces) {
        if (face !== p.face && !turns) continue;
        if (throwTrap(s, p, b, face) && throwSafe(s, p, b, level, face, THROW_TICKS)) return aimAt(face);
      }
    }
    if (!unsafe && level.hunt && b.fuse <= LOADED_FUSE && held < HOLD_LOADED && foeNear(s, p, here, LOAD_NEAR) && survives(s, p.slot, level, THROW_TICKS + 2)) return BTN.A;
    if (!unsafe && aimThrow(s, here, p.face, p.slot) > 4 && held < HOLD_MAX) return BTN.A;
    if (aimThrow(s, here, p.face, p.slot) <= 4 || throwSafe(s, p, b, level, p.face, THROW_TICKS)) return release();
    for (const face of faces) if (face !== p.face && turns && throwSafe(s, p, b, level, face, THROW_TICKS)) return aimAt(face);
    return release();
  }
  if (brain.liftAt >= 0) {
    if (s.tick <= brain.liftAt + 1) { brain.still = true; return BTN.A; }
    brain.liftAt = -1;
  }
  if (!p.glove || p.mount || p.actLeft > 0) return null;
  // pegar o adversário que está na mesma casa (a luva prefere o jogador à bomba) e arremessá-lo: oportunidade, então
  // sempre (menos logo depois de outro arremesso)
  if (level.hunt && s.tick >= brain.cool && foeToGrab(s, p)) {
    brain.still = true;
    if (last & BTN.A) return 0;                                         // solta antes: pegar precisa de borda
    brain.liftAt = s.tick;
    return BTN.A;
  }
  const b = bombAt(s, here);
  if (!b || b.bad || b.chainAt) return null;
  const lift = (): number => {
    brain.still = true;
    if (last & BTN.A) return 0;                                         // solta antes: o levantar precisa de borda
    brain.liftAt = s.tick;
    return BTN.A;
  };
  const delay = 2 + LIFT_TICKS + THROW_TICKS;
  // 1) o arremesso já mata (o pavio para na mão: levanta agora)
  if (faces.some(f => (f === p.face || turns) && b.fuse <= throwKill(s, p, b, f) && throwSafe(s, p, b, level, f, delay))) return lift();
  const cooled = s.tick >= brain.cool && b.owner === p.slot;
  // 1b) prender: o arremesso deixa a bomba onde um adversário perto fica sem refúgio (só às vezes; não mata agora)
  if (cooled && level.hunt && b.type !== 1 && aiRoll(b.id, p.slot, 15, brain.seed) < trapChance(level)
    && faces.some(f => (f === p.face || turns) && throwTrap(s, p, b, f) && throwSafe(s, p, b, level, f, delay))) return lift();
  // 2) carregar: espera o pavio baixar até matar quem está na mira, ou até "carregada" se só há alguém perto
  if (level.hunt && b.type !== 1) {
    let target = -1;
    for (const f of faces) if (f === p.face || turns) target = Math.max(target, throwKill(s, p, b, f));
    const real = target >= 0;                       // há mira que mata
    if (target < 0 && foeNear(s, p, here, LOAD_NEAR)) target = LOADED_FUSE;
    if (target >= 0) {
      if (b.fuse <= target) { if (real || cooled) return lift(); }
      else {
        const hz = hazards(s, p.slot);
        const canWait = escape(s, p, hz, walkBlocked(s, p), level, true, b.fuse - target + 1) !== null;
        // nem sempre espera o pavio baixar: às vezes compensa pegar já e atordoar — mas só se há mesmo como atordoar
        // (e, sem poder esperar, é isso ou morrer)
        const impatient = cooled && canStunFoe(s, p, b, turns) && (!canWait || aiRoll(b.id, p.slot, 12, brain.seed) < level.dropStun);
        if (impatient && survives(s, p.slot, level, 2 + LIFT_TICKS)) return lift();
        if (canWait) { brain.still = true; return 0; }
      }
    }
  }
  // 3) como antes: bomba nossa recém-colocada e alguém na mira — levanta e arremessa (só atordoa); com folga entre uma e outra
  if (!cooled || s.tick - b.born > FRESH) return null;
  const n = aimThrow(s, here, p.face, p.slot);
  if (n > 4) return null;
  const target = s.players.find(q => q.slot !== p.slot && standing(q) && playerCell(q) === stepN(here, p.face, n));
  if (!target || !isFoe(s, p, target)) return null;
  return throwSafe(s, p, b, level, p.face, delay) ? lift() : null;
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
  if (!canKick(p)) return false;
  const n = faceStep(from, face);
  if (s.grid[n] !== CODE.BOMB) return false;
  const b = bombAt(s, n);
  if (!b || b.chainAt || !kickable(s, p, b)) return false;   // inclui: ninguém em cima dela ($C1:33FD)
  const sim = fork(s);
  const sb = sim.bombs.find(x => x.id === b.id)!;
  sb.state = 'kicked'; sb.dir = face as Bomb['dir']; sb.step = 0; sb.kickedBy = p.slot; sb.turn = -1;
  sim.grid[n] = CODE.FLOOR;
  if (from !== playerCell(p)) [sim.players[p.slot].x, sim.players[p.slot].y] = cellCenter(from);
  const kp = kickPath(sim, sb);
  if (kp.trail.length < 2) return false;                                // parada: não sai do lugar
  if (aim === 'hit' && !kp.trail.slice(1).some(c => {
    const w = who(s, p, new Set(crossCells(s, c, b.fire, b.type === 2, undefined, true, b.level ?? 0).cells));
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
    if (wantP(s, p, level)) { brain.still = true; return BTN.Y; }
  }
  const here = playerCell(p);
  if (p.punch && !p.mount && FACES.some(f => bombAt(s, faceStep(here, f)))) {
    const btn = punchPlan(s, p, level, hazards(s, p.slot));
    if (btn !== null) { brain.still = true; return btn === BTN.Y && last & BTN.Y ? 0 : btn; }
  }
  return 0;
}
