// Decisões da IA (porte do legado): fugir → item → bomba com fuga garantida → caçar/blocos → passear.
import { CODE, DISEASE, type Bomb, type Player, type RoundState } from '../types';
import { CELLS, colOf, faceStep, inField, linOf } from '../units';
import { isEggCode, isItemCode, playerCell, standing } from '../state';
import { bombFireOf, canPlaceBomb, fuseOf } from '../bombs';
import { rangeOf } from '../constants';
import { STAGES } from '../stages';
import { MOUNTS } from '../mounts';
import { canKick } from '../kick';
import { SAFE, crossCells, hazards, pressureCells, type Extra, type Hazard } from './danger';
import { kickWorth } from './actions';
import { centered, escape, hasRefuge, lockOf, route, search, ticksPerCell, walkBlocked, type Route } from './nav';
import { aiRoll, type AiLevel } from './level';

export { walkBlocked } from './nav';

/** `go[k]`: tick (absoluto) a partir do qual pode andar rumo a `path[k]` (espera chamas passarem). `push`: face a
 *  apertar para chutar a bomba vizinha (-1 = nenhuma). `liftAt`: tick em que apertou A para levantar com a luva
 *  (-1 = nenhum). `still`: a ação deste tick precisa da CPU parada (sem direção). `seed`: semente do aiRoll. */
export interface Brain {
  path: number[]; go: number[]; bomb: boolean; nextThink: number; push: number; liftAt: number; still: boolean;
  seed: number;
}

export function newBrain(seed = 0): Brain {
  return { path: [], go: [], bomb: false, nextThink: 0, push: -1, liftAt: -1, still: false, seed };
}

/** Quantas casas candidatas (as mais próximas perto de adversários) a caça testa por decisão. */
const HUNT_TRIES = 3;
/** Distância (em casas, Manhattan) até onde um adversário conta como "perto" de uma bomba. */
const HUNT_NEAR = 6;
/** Na pressão, uma bomba a até esta distância de um adversário conta como útil. */
const PRESS_NEAR = 3;
/** Até quantas casas a CPU anda para chutar uma bomba que encurrala um adversário. */
const KICK_WALK = 4;
/** Chegando atrás da bomba para chutá-la, folga mínima (ticks) antes de a casa explodir. */
const KICK_SLACK = 24;
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

/** Peso de ir buscar o que está na casa: 0 = não vale; 1 = item bom; ovo = `eggValue` da montaria. */
function worth(s: RoundState, p: Player, c: number): number {
  const v = s.grid[c];
  if (isEggCode(v)) return Math.max(0, MOUNTS.current.ai?.eggValue?.(s, p.slot, c) ?? 0);
  return isItemCode(v) && !isSkull(v) ? 1 : 0;
}
/** Quantos ticks de caminho a mais valem 1 ponto de peso de um ovo. */
const EGG_TICKS = 16;
/** Na pressão, uma casa cujo bloco pousa mais de 120 ticks depois da chegada ainda serve de destino (§9.8). */
const PRESSURE_DEST = 120;

/** Decide o que fazer: caminho a seguir e se coloca bomba agora. */
export function think(s: RoundState, p: Player, level: AiLevel, brain: Brain, _ai?: unknown): void {
  brain.bomb = false; brain.push = -1;
  const here = playerCell(p);
  if (here < 0) { brain.path = []; brain.go = []; return; }
  const hz = hazards(s, p.slot);
  const blocked = walkBlocked(s, p);
  // na pressão (fim de rodada) todo mundo caça, e quem já caçava também tenta encurralar
  const late = s.pressure.trigger >= 0;
  const foes = level.hunt || late ? foeCells(s, p) : new Set<number>();
  const trap = level.trap || (level.hunt && late);
  const roll = aiRoll(s.tick, p.slot, 1, brain.seed);
  // travado (golpe P, arremesso, atordoado...): só planeja, contando o tempo parado; bomba só destravado
  const lock = lockOf(p);
  // prisão de ventre ($24) e fogo mínimo ($25): não planeja bombas
  const noBombs = p.disease === DISEASE.CONSTIPATION || p.disease === DISEASE.LOW_FIRE;
  const follow = (r: Route | null): void => {
    brain.path = r ? r.path : [];
    brain.go = r ? r.go.map(t => s.tick + t) : [];
  };

  // 1) fugir (também no meio de um passo: a busca parte da posição real)
  if (hz.at[here] !== SAFE) {
    if (roll < level.mistake) { follow(null); return; }   // hesitou
    // chute que encurrala ou pega um adversário (a bomba vizinha põe a casa atual em perigo: acontece aqui)
    if (foes.size && centered(s, p) && roll >= level.mistake) {
      for (const aim of ['trap', 'hit'] as const) {
        for (const face of [0, 2, 4, 6]) if (kickWorth(s, p, face, level, aim)) { follow(null); brain.push = face; return; }
      }
    }
    const out = escape(s, p, hz, blocked, level, true, lock);
    // fugindo, mais uma bomba aqui se for útil (ou encurralar) e a fuga continuar garantida com ela
    if (out && !lock && level.hunt && !noBombs && centered(s, p) && canPlaceBomb(p) && p.carry < 0 && s.grid[here] === CODE.FLOOR
      && !blocked.has(here) && enemiesNear(s, p, here)) {
      const useful = bombUseful(s, p, here, foes) || (late && foeWithin(s, p, here, PRESS_NEAR));
      const b = tryBomb(s, p, here, hz, blocked);
      if ((useful || (trap && b.traps)) && !b.hurtsMate) {
        const lv = late ? { ...level, margin: Math.min(level.margin, LATE_MARGIN) } : level;
        const out2 = escape(s, p, b.hz, b.blocked, lv, true, 1);
        if (out2 && out2.path.length > 0) { brain.bomb = true; follow(out2); return; }
      }
    }
    // sem fuga garantida: chutar uma bomba vizinha pode abri-la (o soco é decidido em decideActions)
    if (!out && centered(s, p)) {
      for (const face of [0, 2, 4, 6]) if (kickWorth(s, p, face, level, 'rescue')) { follow(null); brain.push = face; return; }
    }
    follow(out ?? escape(s, p, hz, blocked, level, false, lock));
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
  const sr = search(s, p, hz, calm, level.margin, lock);
  // alvos (itens, casas para bomba, passeio) só em casas sem perigo previsto; a pressão só conta se o bloco pousa em
  // até 120 ticks depois da chegada
  const pc = late ? pressureCells(s) : null;
  const target = (i: number): boolean => {
    if (sr.time[i] < 0) return false;
    if (hz.at[i] === SAFE) return true;
    const land = pc?.get(i);
    return land !== undefined && hz.at[i] === land + 1 && land - sr.time[i] > PRESSURE_DEST;
  };

  // 2) objetivos da arena (sem limite de distância) e item/ovo perto
  const goals = STAGES[s.stage]?.ai?.goals?.(s, p.slot) ?? [];
  let bestItem = -1, bestScore = 0;
  for (const i of goals) {
    if (i === here || !target(i)) continue;
    if (bestItem < 0 || sr.time[i] < bestScore) { bestItem = i; bestScore = sr.time[i]; }
  }
  if (bestItem < 0) {
    for (let i = 0; i < CELLS; i++) {
      if (sr.time[i] < 0 || sr.dist[i] > 6 || !target(i)) continue;
      const w = worth(s, p, i);
      if (w <= 0) continue;
      const score = sr.time[i] - (w - 1) * EGG_TICKS;
      if (bestItem < 0 || score < bestScore) { bestItem = i; bestScore = score; }
    }
  }
  if (bestItem >= 0 && bestItem !== here && roll >= level.mistake) { follow(route(sr, bestItem)); return; }

  // 2b) doente: vai ao encontro do adversário sem doença mais próximo para passá-la no contato (sem soltar bombas)
  if (p.disease) {
    let best = -1;
    for (const q of standingPlayers(s)) {
      if (q === p || mate(s, p, q) || q.disease) continue;
      const qc = playerCell(q);
      if (qc === here || !target(qc)) continue;
      if (best < 0 || sr.time[qc] < sr.time[best]) best = qc;
    }
    if (best >= 0) { follow(route(sr, best)); return; }
  }

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
  const canPlace = !lock && !noBombs && canPlaceBomb(p) && p.carry < 0 && s.grid[here] === CODE.FLOOR && !blocked.has(here) && !crowded;
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

  // 3b) chutar uma bomba vizinha que encurrala um adversário ou que, parada pelo X em algum ponto do trajeto, o pega
  if (foes.size && roll >= level.mistake) {
    for (const aim of ['trap', 'hit'] as const) {
      for (const face of [0, 2, 4, 6]) if (kickWorth(s, p, face, level, aim)) { follow(null); brain.push = face; return; }
    }
    // 3c) ir até atrás de uma bomba parada cujo chute encurralaria um adversário
    if (canKick(p)) {
      let best = -1;
      for (const b of s.bombs) {
        if (b.state !== 'idle' || b.chainAt || s.grid[b.cell] !== CODE.BOMB) continue;
        for (const face of [0, 2, 4, 6]) {
          const k = faceStep(b.cell, (face + 4) & 7);
          if (k === here || sr.time[k] < 0 || sr.dist[k] > KICK_WALK || hz.at[k] - sr.time[k] < KICK_SLACK
            || (best >= 0 && sr.time[k] >= sr.time[best])) continue;
          if (kickWorth(s, p, face, level, 'trap', k)) best = k;
        }
      }
      if (best >= 0) { follow(route(sr, best)); return; }
    }
  }

  // 4) andar até uma casa de onde uma bomba seria útil: a mais próxima; caçando, antes uma das mais próximas
  //    que encurrale um adversário
  const spots: number[] = [];
  for (let i = 0; !noBombs && i < CELLS; i++) {
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
  follow(options.length ? route(sr, options[aiRoll(s.tick, p.slot, 2, brain.seed) % options.length]) : null);
}

/** Remota mais antiga de `p` ainda sem cadeia (a que o botão B detona). */
export function oldestRemote(s: RoundState, p: Player): Bomb | undefined {
  return s.bombs
    .filter(x => x.owner === p.slot && !x.bad && x.type === 1 && (x.state === 'idle' || x.state === 'kicked') && x.chainAt === 0)
    .sort((a, c) => a.id - c.id)[0];
}
