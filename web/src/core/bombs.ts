// bombs.ts (T6) — pavio, explosões, chamas e queima (decisões 9–13 da spec)
import { BURN, CODE, DISEASE, FLAME_PIECE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { BAD_COOLDOWN, BURN_TICKS, CHAIN_DELAY, FLAME_TICKS, FUSE, FUSE_LONG, FUSE_SHORT, LEVEL_RADIUS, rangeOf } from './constants';
import { CELLS, cellAt, cellCenter, cellOf, colOf, faceStep, inField, inGrid, linOf } from './units';
import { isItemCode, itemCode, itemOfCode, newId, playerCell } from './state';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { slideStep } from './kick';
import { spawnItemFlyer } from './flyers';
import { rnd } from './rng';

const ARM = [FLAME_PIECE.ARM_UP, 0, FLAME_PIECE.ARM_RIGHT, 0, FLAME_PIECE.ARM_DOWN, 0, FLAME_PIECE.ARM_LEFT];
const TIP = [FLAME_PIECE.TIP_UP, 0, FLAME_PIECE.TIP_RIGHT, 0, FLAME_PIECE.TIP_DOWN, 0, FLAME_PIECE.TIP_LEFT];
const isSkullCode = (v: number): boolean => isItemCode(v) && (v & 0xf0) === 0xa0;   // CODE.SKULL + $2x

export function fuseOf(p: Player): number {
  return p.disease === DISEASE.SHORT_FUSE ? FUSE_SHORT : p.disease === DISEASE.LONG_FUSE ? FUSE_LONG : FUSE;
}
export function bombFireOf(p: Player): number {
  return p.disease === DISEASE.LOW_FIRE ? 10 : p.fullFire ? 7 : p.fire;
}
export function canPlaceBomb(p: Player): boolean {
  if (p.bombsFree <= 0 || p.disease === DISEASE.CONSTIPATION) return false;
  return p.disease !== DISEASE.LOW_FIRE || p.bombsFree === p.bombsCap;
}

export function bombAt(s: RoundState, cell: number): Bomb | undefined { return s.bombs.find(b => b.state === 'idle' && b.cell === cell); }
/** Casa `c` ocupada por bomba: parada nela, ou chutada com a casa de origem, a do centro ou (em movimento) a próxima
 *  igual a `c`. Toda bomba nova na grade (pouso, colocação, soltura da luva, parada do chute) passa por aqui, para que
 *  a grade `BOMB` corresponda sempre a exatamente uma bomba parada. `except` = a própria bomba. */
export function bombOccupies(s: RoundState, c: number, except?: Bomb): boolean {
  return s.bombs.some(b => b !== except && (b.state === 'idle' ? b.cell === c
    : b.state === 'kicked' && (b.cell === c || cellAt(b.x, b.y) === c || (b.step > 0 && faceStep(b.cell, b.dir) === c))));
}
export function bombById(s: RoundState, id: number): Bomb | undefined { return s.bombs.find(b => b.id === id); }
/** Cria uma bomba; parada (padrão) ocupa a grade. */
export function addBomb(s: RoundState, owner: number, cell: number, init: Partial<Bomb> = {}): Bomb {
  const [x, y] = cellCenter(cell);
  const b: Bomb = { id: newId(s), owner, bad: false, cell, x, y, fuse: FUSE, fire: 0, type: 0, state: 'idle',
    dir: 4, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: s.tick, level: 0, ...init };
  if (b.state === 'idle') s.grid[cell] = CODE.BOMB;
  s.bombs.push(b);
  return b;
}
/** Devolve a bomba ao dono (ou inicia a cadência do Bad Bomber: +48 ticks). Como $C1:5588: só soma enquanto
 *  disponíveis < capacidade (a perda de capacidade com bombas no campo não deixa "dívida"). */
export function refundBomb(s: RoundState, b: Bomb): void {
  if (b.bad) {
    const bb = s.bad.find(q => q.slot === b.owner);
    if (bb && bb.live === b.id) { bb.live = -1; bb.readyAt = s.tick + BAD_COOLDOWN; }
    return;
  }
  const p = s.players[b.owner];
  if (p) p.bombsFree = Math.min(p.bombsCap, p.bombsFree + 1);
}
/** Tira a bomba do jogo sem explodir (pressão, pouso em bloco queimando). */
export function removeBomb(s: RoundState, b: Bomb, refund: boolean): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  if (b.state === 'idle' && s.grid[b.cell] === CODE.BOMB) s.grid[b.cell] = CODE.FLOOR;
  if (refund) refundBomb(s, b);
}

export function placeBomb(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!canPlaceBomb(p)) return false;
  const cell = playerCell(p);
  // M6 (revisão final do plano 8): a ROM confere a grade lógica, não só a chama, antes de colocar. Em $C1:1D65
  // testa `BIT #$1000` (= CODE.FLAME) e, se limpo, em $C1:1D79 mascara com `AND #$EFC0` e compara com zero antes
  // de escrever a bomba ($C900). ARROW ($0040) e PAD ($0C00) sobrevivem a essa máscara (bits fora dos limpos por
  // `$EFC0`) e caem no mesmo desvio de rejeição que item/bomba — a ROM também não deixa colocar bomba em cima de
  // seta (arena 7) nem de pad (arena 8). `!== CODE.FLOOR` já é o comportamento certo; ver teste de fixação abaixo.
  if (cell < 0 || s.grid[cell] !== CODE.FLOOR) return false;
  if (bombOccupies(s, cell)) return false;
  addBomb(s, p.slot, cell, { fuse: fuseOf(p), fire: bombFireOf(p), type: MOUNTS.current.bombType?.(p) ?? p.bombType });
  p.bombsFree--;
  ev.push({ type: 'bomb_placed', slot: p.slot, cell });
  return true;
}

export function setFlame(s: RoundState, cell: number, piece: number): void {
  s.grid[cell] = CODE.FLAME; s.cellT0[cell] = s.tick; s.cellAux[cell] = piece;
}
export function burnCell(s: RoundState, cell: number, kind: number): void {
  s.grid[cell] = CODE.BURNING; s.cellT0[cell] = s.tick; s.cellAux[cell] = kind;
}

/** Bomba evoluída (D/S/H): casas do quadrado de raio LEVEL_RADIUS em volta de `c0` dentro do campo, menos parede,
 *  pilar e pressão. `bombs` = casas com bomba na grade (cadeia); `cells` = o resto (inclui `c0`). Atravessa blocos. */
export function areaCells(s: RoundState, c0: number, level: number, asBomb?: ReadonlySet<number>): { cells: number[]; bombs: number[] } {
  const r = LEVEL_RADIUS[level] ?? 0, col0 = colOf(c0), lin0 = linOf(c0);
  const cells = [c0], bombs: number[] = [];
  for (let lin = lin0 - r; lin <= lin0 + r; lin++) for (let col = col0 - r; col <= col0 + r; col++) {
    if (!inField(col, lin)) continue;
    const c = cellOf(col, lin);
    if (c === c0) continue;
    const v = s.grid[c];
    if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) continue;
    if (v === CODE.BOMB || asBomb?.has(c)) bombs.push(c); else cells.push(c);
  }
  return { cells, bombs };
}

/** Explosão por área da bomba evoluída: cada casa vira chama (peça pela vizinhança, para as linhas saírem ligadas),
 *  bloco queima, item queima, caveira pula e bomba entra na cadeia. */
function explodeArea(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const st = STAGES[s.stage];
  const { cells, bombs } = areaCells(s, b.cell, b.level ?? 0);
  const lit = new Set(cells);
  const piece = (c: number): number => {
    const l = lit.has(faceStep(c, 6)), r = lit.has(faceStep(c, 2)), u = lit.has(faceStep(c, 0)), d = lit.has(faceStep(c, 4));
    if ((l || r) && (u || d)) return FLAME_PIECE.CENTER;
    if (l && r) return ARM[2];
    if (u && d) return ARM[0];
    return l ? TIP[2] : r ? TIP[6] : u ? TIP[4] : d ? TIP[0] : FLAME_PIECE.CENTER;
  };
  for (const c of cells) {
    if (c === b.cell) continue;
    const v = s.grid[c];
    if (v === CODE.SOFT) burnCell(s, c, BURN.SOFT);
    else if (isSkullCode(v)) { s.grid[c] = CODE.FLOOR; spawnItemFlyer(s, itemOfCode(v), c, rnd(s.rng, 12)); }
    else if (isItemCode(v)) burnCell(s, c, BURN.ITEM);
    else if (v === CODE.FLOOR || v === CODE.FLAME) setFlame(s, c, piece(c));
    st?.onFlameCell?.(s, c, -1, ev);
  }
  for (const c of bombs) {
    const o = bombAt(s, c);
    if (o && (o.chainAt === 0 || o.chainAt > s.tick + CHAIN_DELAY)) o.chainAt = s.tick + CHAIN_DELAY;
  }
}

export function explodeBomb(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  refundBomb(s, b);
  const st = STAGES[s.stage];
  const c0 = b.cell;
  const v0 = s.grid[c0];
  if (v0 === CODE.BOMB || v0 === CODE.FLOOR || v0 === CODE.FLAME) setFlame(s, c0, FLAME_PIECE.CENTER);
  st?.onFlameCell?.(s, c0, -1, ev);            // plano 8: toda casa alcançada chama o gancho (centro = −1, primeiro)
  ev.push({ type: 'explosion', cell: c0, owner: b.owner });
  if (b.level) { explodeArea(s, b, ev); return; }
  const range = rangeOf(b.fire);
  for (const face of [0, 2, 4, 6]) {
    let c = c0, last = -1;
    for (let k = 1; k <= range; k++) {
      c = faceStep(c, face);
      if (!inGrid(colOf(c), linOf(c))) break;
      const v = s.grid[c];
      if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) break;
      if (v === CODE.SOFT) { burnCell(s, c, BURN.SOFT); st?.onFlameCell?.(s, c, face, ev); if (b.type === 2) continue; break; }
      if (isSkullCode(v)) {   // caveira não queima: pula como a que sai do jogador curado; o braço para nela
        s.grid[c] = CODE.FLOOR;
        spawnItemFlyer(s, itemOfCode(v), c, rnd(s.rng, 12));
        st?.onFlameCell?.(s, c, face, ev);
        break;
      }
      if (isItemCode(v)) { burnCell(s, c, BURN.ITEM); st?.onFlameCell?.(s, c, face, ev); break; }
      if (v === CODE.BOMB) {
        const o = bombAt(s, c);
        if (o && (o.chainAt === 0 || o.chainAt > s.tick + CHAIN_DELAY)) o.chainAt = s.tick + CHAIN_DELAY;
        break;
      }
      if (v === CODE.FLOOR || v === CODE.FLAME) { setFlame(s, c, ARM[face]); last = c; st?.onFlameCell?.(s, c, face, ev); continue; }
      st?.onFlameCell?.(s, c, face, ev);         // código especial passável: a arena decide; o braço segue
    }
    if (last >= 0) s.cellAux[last] = TIP[face];
  }
}

export function detonateRemote(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  const b = s.bombs
    .filter(x => x.owner === p.slot && !x.bad && x.type === 1 && (x.state === 'idle' || x.state === 'kicked') && x.chainAt === 0)
    .sort((a, c) => a.id - c.id)[0];
  if (!b) return false;
  b.chainAt = s.tick;
  return true;
}

export function revealCell(s: RoundState, cell: number, ev: GameEvent[]): void {
  s.grid[cell] = CODE.FLOOR; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
  const k = s.hidden.findIndex(([c]) => c === cell);
  if (k < 0) return;
  const item = s.hidden[k][1];
  s.hidden.splice(k, 1);
  if (item >= 0x30 && item <= 0x3f) MOUNTS.current.revealEgg(s, cell, ev);
  else s.grid[cell] = itemCode(item);
}

export function tickBombs(s: RoundState, ev: GameEvent[]): void {
  if (s.phase === 'won') return;
  const st = STAGES[s.stage];
  for (const b of [...s.bombs]) {
    if (!s.bombs.includes(b)) continue;
    if (b.born === s.tick || b.state === 'held' || b.state === 'air') continue;
    if (b.chainAt && s.tick >= b.chainAt) { explodeBomb(s, b, ev); continue; }
    if (b.state === 'kicked') {
      slideStep(s, b, ev);
      if (s.grid[b.cell] === CODE.FLAME && !b.chainAt) b.chainAt = s.tick + 1;
    }
    if (b.type === 1) continue;
    if (b.fuse === 0) { explodeBomb(s, b, ev); continue; }
    b.fuse = Math.max(0, b.fuse - (st?.fuseStep?.(s, b) ?? 1));
  }
}

export function tickCells(s: RoundState, ev: GameEvent[]): void {
  for (let c = 0; c < CELLS; c++) {
    const v = s.grid[c];
    if (v === CODE.FLAME && s.tick - s.cellT0[c] >= FLAME_TICKS) { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    else if (v === CODE.BURNING && s.tick - s.cellT0[c] >= BURN_TICKS) {
      if (s.cellAux[c] === BURN.SOFT) revealCell(s, c, ev);
      else { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    }
  }
}
