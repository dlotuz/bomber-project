// Mapa de perigo da IA. Tudo em offsets de tick a partir do próximo (1 = o próximo `step`). Uma bomba que explode no
// passo de objetos do offset `t` fere quem está na casa nos offsets t+1 … t+25: janela [at, end) = [t+1, t+26).
import { CODE, type Bomb, type Flyer, type RoundState } from '../types';
import { CELLS, WRAP_X, WRAP_Y, SUB, cellAt, cellCenter, colAt, colOf, faceStep, inField, inGrid, linAt, linOf } from '../units';
import { BURN_TICKS, CHAIN_DELAY, FLAME_TICKS, KICK_STEPS, PRESSURE_EVERY, PRESSURE_FIRST, fallTicks, rangeOf } from '../constants';
import { BOUNCE, ITEM_FLIGHT, PUNCH, THROW, type Script } from '../tables/flights';
import { isEggCode, isItemCode, playerCell, standing } from '../state';
import { STAGES } from '../stages';
import { pressureSpiral } from '../pressure';
import { pressureTriggerSec } from '../clock';

/** Casa que nenhuma chama conhecida vai atingir. */
export const SAFE = 1_000_000;
/** Quantos ticks antes do gatilho da pressão a IA já trata as casas que vão cair como condenadas (como no legado). */
export const PRESSURE_LEAD = 300;
/** Pavio da bomba hipotética (a que a IA pensa em soltar agora): explode 127 ticks depois. */
export const EXTRA_T = 127;

/** Casa mortal nos offsets [at, end); at = SAFE: nenhuma explosão prevista; end = SAFE: para sempre (pressão, remota). */
export interface Hazard { at: Int32Array; end: Int32Array }
/** Bomba hipotética: `t` = offset do passo em que explode (padrão 127). */
export interface Extra { cell: number; fire: number; pierce: boolean; t?: number }

/** Casas atingidas por uma explosão em `cell` (mesmas regras de explodeBomb) e as bombas alcançadas (cadeia).
 *  `asBomb`: casas tratadas como bomba parada além das da grade (hipotética, ponto de parada de uma chutada).
 *  `itemsStop` = false: o braço segue depois de um item (alguém pode pegá-lo antes da explosão; uso do perigo). */
export function crossCells(s: RoundState, cell: number, fire: number, pierce: boolean, asBomb?: ReadonlySet<number>,
  itemsStop = true): { cells: number[]; bombs: number[] } {
  const cells = [cell], bombs: number[] = [];
  const range = rangeOf(fire);
  for (const face of [0, 2, 4, 6]) {
    let c = cell;
    for (let k = 1; k <= range; k++) {
      c = faceStep(c, face);
      if (!inGrid(colOf(c), linOf(c))) break;
      const v = s.grid[c];
      if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) break;
      if (v === CODE.BOMB || asBomb?.has(c)) { bombs.push(c); break; }
      cells.push(c);
      if (v === CODE.SOFT) { if (pierce) continue; break; }
      if (itemsStop && isItemCode(v)) break;
    }
  }
  return { cells, bombs };
}

/** Offset do passo em que o pavio chega a 0 e a bomba explode (com o `fuseStep` da arena). */
function fuseOnly(s: RoundState, b: Bomb): number {
  const st = STAGES[s.stage]?.fuseStep?.(s, b) ?? 1;
  return st >= 2 ? Math.ceil(b.fuse / 2) + 1 : st === 0 ? 2 * b.fuse + 1 : b.fuse + 1;
}

/** Offset da explosão de uma bomba parada (cadeia marcada ou pavio). */
function fuseTicks(s: RoundState, b: Bomb): number {
  const chain = b.chainAt ? Math.max(1, b.chainAt - s.tick) : SAFE;
  return b.type === 1 ? chain : Math.min(chain, fuseOnly(s, b));
}

/** Previsão do deslize (mesmas paradas de slideStep, jogadores nas posições atuais): casa e offset da explosão e as
 *  casas por onde passa. Explode onde estiver quando o pavio acaba (depois do passo de deslize) ou, com a cadeia
 *  marcada (entrou em chama: 1 tick depois), antes de deslizar. Remota sem cadeia: t = SAFE (vai até parar). */
export function kickPath(s: RoundState, b: Bomb): { cell: number; t: number; trail: number[] } {
  let tChain = b.chainAt ? Math.max(1, b.chainAt - s.tick) : SAFE;
  const tFuse = b.type === 1 ? SAFE : fuseOnly(s, b);
  const hint = STAGES[s.stage]?.ai?.kickEnd?.(s, b.cell, b.dir);
  if (hint != null) return { cell: hint, t: Math.min(tChain, tFuse), trail: [b.cell, hint] };
  let cell = b.cell, dir = b.dir as number, stepN = b.step, turn = b.turn;
  const trail = [cell];
  const limit = Math.min(tFuse, 16 * KICK_STEPS);
  for (let o = 1; o <= limit; o++) {
    if (o >= tChain) return { cell, t: tChain, trail };
    if (stepN === 0) {
      const next = faceStep(cell, dir);
      const v = s.grid[next] ?? CODE.HARD;
      const blocked = (v & 0x8400) !== 0 || isEggCode(v)
        || s.bombs.some(x => x !== b && x.cell === next && (x.state === 'idle' || x.state === 'kicked'))
        || s.players.some(q => standing(q) && playerCell(q) === next);
      if (blocked) break;
      if (v === CODE.FLAME) tChain = Math.min(tChain, o + 1);
    }
    if (++stepN === KICK_STEPS) {
      stepN = 0; cell = faceStep(cell, dir); trail.push(cell);
      if (turn >= 0) { dir = turn; turn = -1; }
    }
    if (o === tFuse) return { cell, t: o, trail };
  }
  return { cell, t: Math.min(tChain, tFuse), trail };
}

function scriptOf(f: Flyer): Script {
  if (f.flight === 'punch') return PUNCH[f.dir];
  if (f.flight === 'bounce') return BOUNCE[f.dir];
  if (f.flight === 'item') return ITEM_FLIGHT[f.script].script;
  return THROW[Number(f.flight.slice(5)) as 2 | 3 | 4 | 5][f.dir];
}

/** Percorre o resto do script a partir de (x, y, passo i) com a volta pela borda: ponto de pouso. */
function runScript(x: number, y: number, dir: number, sc: Script, i: number): { x: number; y: number; n: number } {
  let n = 0;
  for (; i < sc.length; i++, n++) {
    const [dx, dy] = sc[i];
    x += dx * SUB; if (dir === 0 || dir === 2) y += dy * SUB;
    const col = colAt(x), lin = linAt(y);
    if (col > 16) x -= WRAP_X; else if (col < 0) x += WRAP_X;
    if (lin > 12) y -= WRAP_Y; else if (lin < 0) y += WRAP_Y;
  }
  return { x, y, n };
}

/** Casa do 1º pouso (antes de qualquer quique) de um voo `flight` saindo de (x, y) na direção `dir` (0..3). */
export function firstLanding(x: number, y: number, dir: 0 | 1 | 2 | 3, flight: Flyer['flight']): number {
  const r = runScript(x, y, dir, scriptOf({ flight, dir, script: 0 } as Flyer), 0);
  return cellAt(r.x, r.y);
}

/** Casa e offset (passo de objetos) de pouso de um voador (até 8 quiques, regras de T8). */
export function flightEnd(s: RoundState, f: Flyer): { cell: number; t: number } {
  let x = f.x, y = f.y, i = f.i, sc = scriptOf(f), t = 0;
  for (let bounces = 0; bounces <= 8; bounces++) {
    const r = runScript(x, y, f.dir, sc, i);
    x = r.x; y = r.y; t += r.n;
    const cell = cellAt(x, y);
    const v = cell >= 0 && inField(colOf(cell), linOf(cell)) ? s.grid[cell] : CODE.HARD;
    const player = s.players.some(q => standing(q) && playerCell(q) === cell);
    if (!player && (v === CODE.FLOOR || v === CODE.FLAME || v === CODE.BURNING)) return { cell, t };
    [x, y] = cellCenter(cell); sc = BOUNCE[f.dir]; i = 0;
  }
  return { cell: cellAt(x, y), t };
}

/** Tick do gatilho da pressão: o real ou o previsto pelo relógio; -1 = não haverá (relógio parado ou já passou). */
export function pressureTriggerTick(s: RoundState): number {
  if (s.pressure.trigger >= 0) return s.pressure.trigger;
  const trig = pressureTriggerSec(s.rules.timeIdx), c = s.clock;
  if (c.sec >= 600 || c.sec <= trig) return -1;
  return s.tick + (c.sec - trig - 1) * 60 + c.sub;
}

/** Casa → offset de pouso do bloco de pressão (prevê o gatilho pelo relógio). */
export function pressureCells(s: RoundState): Map<number, number> {
  const pr = s.pressure, out = new Map<number, number>();
  const T = pressureTriggerTick(s);
  if (T < 0) return out;
  for (const f of pr.falling) out.set(f.cell, f.land - s.tick);
  const sp = pressureSpiral();
  for (let k = pr.next; k < pr.total; k++) {
    const at = T + PRESSURE_FIRST + PRESSURE_EVERY * k;
    if (at <= s.tick) continue;
    const c = sp[k], v = s.grid[c];
    if (v === CODE.HARD || v === CODE.PRESSURE) continue;
    out.set(c, at + fallTicks(linOf(c)) - s.tick);
  }
  return out;
}

/** Offset em que cada casa BURNING volta a ser passável (0 = já é). */
export function blockedUntil(s: RoundState): Int32Array {
  const out = new Int32Array(CELLS);
  for (let c = 0; c < CELLS; c++) if (s.grid[c] === CODE.BURNING) out[c] = s.cellT0[c] + BURN_TICKS + 1 - s.tick;
  return out;
}

interface Blast { cell: number; t: number; fire: number; pierce: boolean; trail: number[]; perm?: boolean }

/**
 * Perigo previsto de cada casa para o jogador `forSlot` (as remotas dele não contam: ele decide quando detoná-las).
 * `extra`: bomba(s) hipotética(s) (para decidir se dá para fugir antes de colocá-la).
 */
export function hazards(s: RoundState, forSlot = -1, extra?: Extra | readonly Extra[]): Hazard {
  const at = new Int32Array(CELLS).fill(SAFE), end = new Int32Array(CELLS).fill(0);
  const mark = (c: number, a: number, e: number): void => {
    if (c < 0 || c >= CELLS) return;
    at[c] = Math.min(at[c], a); end[c] = Math.max(end[c], e);
  };
  const blasts: Blast[] = [];
  const asBomb = new Set<number>();
  for (const b of s.bombs) {
    if (b.state === 'held') continue;                                     // na mão: pavio parado
    const remote = b.type === 1 && !b.chainAt;
    if (remote && b.owner === forSlot && !b.bad) continue;
    const pierce = b.type === 2;
    if (b.state === 'air') {                                              // no ar: pavio parado até pousar
      const f = s.flyers.find(x => x.kind === 'bomb' && x.ref === b.id);
      if (!f) continue;
      const e = flightEnd(s, f);
      const t = remote ? 0 : s.grid[e.cell] === CODE.FLAME ? e.t + CHAIN_DELAY : e.t + b.fuse + 1;
      blasts.push({ cell: e.cell, t, fire: b.fire, pierce, trail: [], perm: remote });
      continue;
    }
    if (b.state === 'kicked') {
      const k = kickPath(s, b);
      asBomb.add(k.cell);
      blasts.push({ cell: k.cell, t: remote ? 0 : k.t, fire: b.fire, pierce, trail: k.trail, perm: remote });
      continue;
    }
    if (remote) { blasts.push({ cell: b.cell, t: 0, fire: b.fire, pierce, trail: [], perm: true }); continue; }
    blasts.push({ cell: b.cell, t: fuseTicks(s, b), fire: b.fire, pierce, trail: [] });
  }
  const extras: readonly Extra[] = extra === undefined ? [] : 'cell' in extra ? [extra as Extra] : extra as readonly Extra[];
  for (const e of extras) {
    asBomb.add(e.cell);
    blasts.push({ cell: e.cell, t: e.t ?? EXTRA_T, fire: e.fire, pierce: e.pierce, trail: [] });
  }
  const crosses = blasts.map(x => crossCells(s, x.cell, x.fire, x.pierce, asBomb, false));
  // cadeia: a 1ª bomba alcançada em cada braço explode 2 ticks depois (até estabilizar). Uma remota de adversário pode
  // ser detonada a qualquer momento: o que ela alcança vira perigo permanente também.
  for (let changed = true, guard = 0; changed && guard <= blasts.length; guard++) {
    changed = false;
    blasts.forEach((a, ia) => {
      for (const bc of crosses[ia].bombs) blasts.forEach(b => {
        if (b.cell !== bc || b.perm) return;
        if (a.perm) { b.perm = true; b.t = 0; changed = true; }
        else if (b.t > a.t + CHAIN_DELAY) { b.t = a.t + CHAIN_DELAY; changed = true; }
      });
    });
  }
  blasts.forEach((b, k) => {
    for (const c of crosses[k].cells.concat(b.trail)) mark(c, b.t + 1, b.perm ? SAFE : b.t + 1 + FLAME_TICKS);
  });
  for (let c = 0; c < CELLS; c++) if (s.grid[c] === CODE.FLAME) mark(c, 1, s.cellT0[c] + FLAME_TICKS + 1 - s.tick);
  const T = pressureTriggerTick(s);
  if (T >= 0 && T - s.tick <= PRESSURE_LEAD) for (const [c, land] of pressureCells(s)) mark(c, land + 1, SAFE);
  const extraDanger = STAGES[s.stage]?.ai?.danger?.(s);
  if (extraDanger) for (const [c, o] of extraDanger) mark(c, o, o + FLAME_TICKS);
  return { at, end };
}

export function dangerMap(s: RoundState, forSlot = -1, extra?: Extra | readonly Extra[]): Int32Array {
  return hazards(s, forSlot, extra).at;
}
