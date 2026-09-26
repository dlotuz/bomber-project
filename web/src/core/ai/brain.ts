// Decisões da IA (porte do legado): fugir → item → bomba com fuga garantida → caçar/blocos → passear.
import { CODE, DISEASE, type Bomb, type Player, type RoundState } from '../types';
import { CELLS, cellAt, colOf, faceStep, inField, linOf } from '../units';
import { isEggCode, isItemCode, playerCell, standing } from '../state';
import { bombFireOf, canPlaceBomb, fuseOf } from '../bombs';
import { rangeOf } from '../constants';
import { STAGES } from '../stages';
import { MOUNTS } from '../mounts';
import { SAFE, crossCells, hazards, type Extra, type Hazard } from './danger';
import { centered, escape, hasRefuge, route, search, ticksPerCell, type Route } from './nav';
import { aiRoll, type AiLevel } from './level';

/** `go[k]`: tick (absoluto) a partir do qual pode andar rumo a `path[k]` (espera chamas passarem). */
export interface Brain { path: number[]; go: number[]; bomb: boolean; nextThink: number }

export function newBrain(): Brain { return { path: [], go: [], bomb: false, nextThink: 0 }; }

/** Quantas casas candidatas (as mais próximas perto de adversários) a caça testa por decisão. */
const HUNT_TRIES = 3;
/** Distância (em casas, Manhattan) até onde um adversário conta como "perto" de uma bomba. */
const HUNT_NEAR = 6;
/** Na pressão, uma bomba a até esta distância de um adversário conta como útil. */
const PRESS_NEAR = 3;
/** Na pressão, folga máxima exigida na fuga da própria bomba (arrisca mais para decidir a rodada). */
const LATE_MARGIN = 2;

const manhattan = (a: number, b: number): number => Math.abs(colOf(a) - colOf(b)) + Math.abs(linOf(a) - linOf(b));

/** Jogadores de pé. */
function standingPlayers(s: RoundState): Player[] { return s.players.filter(standing); }

/** Colega de time (só no modo `team`): nunca é alvo e não pode estar no alcance de uma bomba nossa. */
function mate(s: RoundState, p: Player, q: Player): boolean {
  return q !== p && s.rules.mode === 'team' && q.team === p.team;
}

/** Tipo das bombas que `p` solta (a montaria pode trocar). */
export function bombTypeOf(p: Player): 0 | 1 | 2 {
  return MOUNTS.current.bombType?.(p) ?? p.bombType;
}

/** Bomba hipotética de `p` em `cell`, solta `after` ticks depois do próximo (pavio com as caveiras $27/$28). */
function extraOf(p: Player, cell: number, after = 0): Extra {
  return { cell, fire: bombFireOf(p), pierce: bombTypeOf(p) === 2, t: fuseOf(p) + 1 + after };
}

/** Bloqueios extras para andar: bombas deslizando e casas que a arena manda evitar. */
export function walkBlocked(s: RoundState, p: Player): Set<number> {
  const out = new Set<number>();
  for (const b of s.bombs) if (b.state === 'kicked') { const c = cellAt(b.x, b.y); if (c >= 0) out.add(c); }
  const avoid = STAGES[s.stage]?.ai?.avoid?.(s, p.slot);
  if (avoid) for (const c of avoid) out.add(c);
  return out;
}

/** Casas ocupadas por adversários de `p` (alvos da caça). */
function foeCells(s: RoundState, p: Player): Set<number> {
  const out = new Set<number>();
  for (const q of standingPlayers(s)) if (q !== p && !mate(s, p, q)) out.add(playerCell(q));
  return out;
}

/** Uma bomba aqui atingiria um bloco destrutível ou um adversário (`foes`: casas dos alvos; vazio sem caça)? */
function bombUseful(s: RoundState, p: Player, cell: number, foes: ReadonlySet<number>): boolean {
  for (const i of crossCells(s, cell, bombFireOf(p), bombTypeOf(p) === 2).cells) {
    if (s.grid[i] === CODE.SOFT) return true;
    if (foes.has(i)) return true;
  }
  return false;
}

/** Algum adversário a até `d` casas? */
function foeWithin(s: RoundState, p: Player, cell: number, d: number): boolean {
  return standingPlayers(s).some(q => q !== p && !mate(s, p, q) && manhattan(playerCell(q), cell) <= d);
}

/** Algum adversário perto da casa? */
function enemiesNear(s: RoundState, p: Player, cell: number): boolean {
  return standingPlayers(s).some(q => q !== p && !mate(s, p, q) && manhattan(playerCell(q), cell) <= HUNT_NEAR);
}

/** Efeito de uma bomba de `p` em `cell`: perigo e bloqueios com ela; se pega/encurrala um colega de time; se deixa
 *  algum adversário perto sem refúgio. */
function tryBomb(s: RoundState, p: Player, cell: number, hz: Hazard, blocked: ReadonlySet<number>):
  { hz: Hazard; blocked: Set<number>; hurtsMate: boolean; traps: boolean } {
  const withBomb = hazards(s, p.slot, extraOf(p, cell));
  const blockedWith = new Set(blocked).add(cell);
  let hurtsMate = false, traps = false;
  let arm: number[] | null = null;
  for (const q of standingPlayers(s)) {
    if (q === p) continue;
    const c = playerCell(q);
    const near = manhattan(c, cell);
    if (mate(s, p, q)) {
      arm ??= crossCells(s, cell, bombFireOf(p), bombTypeOf(p) === 2, blockedWith).cells;
      // (colega com diarreia solta bombas sem parar e se prende sozinho: nem perto dele)
      if (arm.includes(c) || withBomb.at[c] < hz.at[c] ||
        (q.disease === DISEASE.DIARRHEA && near <= rangeOf(bombFireOf(p)) + 2) ||
        (near <= 10 && hasRefuge(s, q, hz, blocked) && !hasRefuge(s, q, withBomb, blockedWith))) hurtsMate = true;
    } else if (!traps && near <= HUNT_NEAR && !hasRefuge(s, q, withBomb, blockedWith)) {
      traps = true;
    }
  }
  return { hz: withBomb, blocked: blockedWith, hurtsMate, traps };
}

/** Ainda haveria fuga da nossa bomba em `cell` se cada adversário perto soltasse uma bomba no tick seguinte (e, se
 *  estiver andando, outra na casa da frente)? */
function waryEscape(s: RoundState, p: Player, cell: number, blocked: ReadonlySet<number>, level: AiLevel): boolean {
  const extra: Extra[] = [extraOf(p, cell)];
  const blockedAll = new Set(blocked);
  for (const q of standingPlayers(s)) {
    if (q === p || mate(s, p, q) || !canPlaceBomb(q)) continue;
    const qc = playerCell(q);
    if (manhattan(qc, cell) > HUNT_NEAR) continue;
    extra.push(extraOf(q, qc, 1));
    blockedAll.add(qc);
    // andando: também uma bomba na casa da frente, quando ele chegar lá
    const ahead = faceStep(qc, q.face);
    if (q.moveDir !== 8 && ahead !== cell && s.grid[ahead] === CODE.FLOOR) {
      extra.push(extraOf(q, ahead, 1 + ticksPerCell(s, q)));
      blockedAll.add(ahead);
    }
  }
  if (extra.length === 1) return true;
  return escape(s, p, hazards(s, p.slot, extra), blockedAll, level, true, 1) !== null;
}

/** Caveira no chão ($0980+id). */
const isSkull = (v: number): boolean => isItemCode(v) && !isEggCode(v) && (v & 0xff) >= 0x80;

/** Vale a pena ir buscar o que está na casa (item bom, ovo, alvo da arena)? */
function wanted(s: RoundState, p: Player, c: number, goals: ReadonlySet<number>): boolean {
  const v = s.grid[c];
  if (isEggCode(v)) return (MOUNTS.current.ai?.eggValue?.(s, p.slot, c) ?? 0) > 0;
  if (isItemCode(v)) return !isSkull(v);
  return goals.has(c);
}

/** Decide o que fazer: caminho a seguir e se coloca bomba agora. */
export function think(s: RoundState, p: Player, level: AiLevel, brain: Brain, _ai?: unknown): void {
  brain.bomb = false;
  const here = playerCell(p);
  if (here < 0) { brain.path = []; brain.go = []; return; }
  const hz = hazards(s, p.slot);
  const blocked = walkBlocked(s, p);
  // na pressão (fim de rodada) todo mundo caça, e quem já caçava também tenta encurralar
  const late = s.pressure.trigger >= 0;
  const foes = level.hunt || late ? foeCells(s, p) : new Set<number>();
  const trap = level.trap || (level.hunt && late);
  const roll = aiRoll(s.tick, p.slot, 1);
  const follow = (r: Route | null): void => {
    brain.path = r ? r.path : [];
    brain.go = r ? r.go.map(t => s.tick + t) : [];
  };

  // 1) fugir (também no meio de um passo: a busca parte da posição real)
  if (hz.at[here] !== SAFE) {
    if (roll < level.mistake) { follow(null); return; }   // hesitou
    follow(escape(s, p, hz, blocked, level, false, 0));
    return;
  }

  // Fora de perigo e entre duas casas: continua o caminho atual (ou centraliza) em vez de replanejar no meio do passo.
  if (!centered(s, p)) {
    if (brain.path.length === 0) { brain.path = [here]; brain.go = [0]; }
    return;
  }

  // sem pressa, não pisa em caveira (nem para buscar item nem na fuga da própria bomba)
  const calm = new Set(blocked);
  for (let i = 0; i < CELLS; i++) if (isSkull(s.grid[i])) calm.add(i);
  const sr = search(s, p, hz, calm, level.margin, 0);
  // alvos (itens, casas para bomba, passeio) só em casas sem perigo nenhum previsto
  const target = (i: number): boolean => sr.time[i] >= 0 && hz.at[i] === SAFE;

  // 2) item perto
  const goals = new Set(STAGES[s.stage]?.ai?.goals?.(s, p.slot) ?? []);
  let bestItem = -1;
  for (let i = 0; i < CELLS; i++) {
    if (sr.time[i] < 0 || !wanted(s, p, i, goals) || !target(i) || sr.dist[i] > 6) continue;
    if (bestItem < 0 || sr.time[i] < sr.time[bestItem]) bestItem = i;
  }
  if (bestItem >= 0 && bestItem !== here && roll >= level.mistake) { follow(route(sr, bestItem)); return; }

  // 3) bomba aqui, se for útil e der para fugir dela pela busca estrita. Estamos centrados: ela cai nesta casa. Neste
  //    tick só solta a bomba; a fuga começa no seguinte (delay 1). Fora da pressão, nunca com outro jogador com Luva
  //    na mesma casa nem com alguém com Chute na vizinha olhando para cá (na pressão isso travava dois CPUs colados um
  //    no outro, andando juntos, sem nenhum soltar bomba).
  const crowded = !late && standingPlayers(s).some(q => {
    if (q === p) return false;
    const qc = playerCell(q);
    if (q.glove && qc === here) return true;
    return (q.kick || !!MOUNTS.current.kicks?.(q)) && faceStep(qc, q.face) === here;
  });
  const canPlace = canPlaceBomb(p) && p.carry < 0 && s.grid[here] === CODE.FLOOR && !blocked.has(here) && !crowded;
  if (canPlace) {
    // na pressão, bomba colada num adversário também vale (fecha refúgios); e ninguém fica só na defensiva (`wary`)
    const useful = bombUseful(s, p, here, foes) || (late && foeWithin(s, p, here, PRESS_NEAR));
    if (useful || (trap && enemiesNear(s, p, here))) {
      const b = tryBomb(s, p, here, hz, blocked);
      const wary = level.wary && !late;
      if (!b.hurtsMate && (useful || b.traps) && (!wary || waryEscape(s, p, here, b.blocked, level))) {
        const outBlocked = new Set(calm).add(here);
        const lv = late ? { ...level, margin: Math.min(level.margin, LATE_MARGIN) } : level;
        const out = escape(s, p, b.hz, outBlocked, lv, true, 1);
        if (out && out.path.length > 0) { brain.bomb = true; follow(out); return; }
      }
    }
  }

  // 4) andar até uma casa de onde uma bomba seria útil: a mais próxima; caçando, antes uma das mais próximas
  //    que encurrale um adversário
  const spots: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (i !== here && target(i) && bombUseful(s, p, i, foes)) spots.push(i);
  }
  spots.sort((a, b) => sr.time[a] - sr.time[b] || a - b);
  let bestSpot = spots.length ? spots[0] : -1;
  if (trap) {
    let tried = 0;
    for (const i of spots) {
      if (!enemiesNear(s, p, i)) continue;
      if (tryBomb(s, p, i, hz, blocked).traps) { bestSpot = i; break; }
      if (++tried >= HUNT_TRIES) break;
    }
  }
  if (bestSpot >= 0 && roll >= level.mistake) { follow(route(sr, bestSpot)); return; }

  // 5) na pressão, sem nada melhor: chegar perto de um adversário (a 2 casas) em vez de passear
  if (late) {
    let best = -1;
    const foeList = standingPlayers(s).filter(q => q !== p && !mate(s, p, q)).map(playerCell);
    for (let i = 0; i < CELLS; i++) {
      if (i === here || !target(i) || !foeList.some(qc => manhattan(i, qc) <= 2)) continue;
      if (best < 0 || sr.time[i] < sr.time[best]) best = i;
    }
    if (best >= 0) { follow(route(sr, best)); return; }
  }

  // 6) passear para uma vizinha segura
  const options: number[] = [];
  for (const face of [0, 2, 4, 6]) {
    const i = faceStep(here, face);
    if (inField(colOf(i), linOf(i)) && target(i) && sr.dist[i] === 1) options.push(i);
  }
  follow(options.length ? route(sr, options[aiRoll(s.tick, p.slot, 2) % options.length]) : null);
}

/** Remota mais antiga de `p` ainda sem cadeia (a que o botão B detona). */
export function oldestRemote(s: RoundState, p: Player): Bomb | undefined {
  return s.bombs
    .filter(x => x.owner === p.slot && !x.bad && x.type === 1 && (x.state === 'idle' || x.state === 'kicked') && x.chainAt === 0)
    .sort((a, c) => a.id - c.id)[0];
}
