import type { RoundState, Player } from '../types';
import { CODE } from '../types';
import { mstate, type MountProjectile, type MountState, type ProjKind } from './types';
import { cellAt, cellOf, colOf, linOf, centerX, centerY, GRID_W, GRID_H, isEnemy } from './core-api';

/** Modelo por casas medido no emulador (relatório da T3 do plano 9; testes de bloqueio do ajuste C). Posições em
 *  1/256 px; k = s.tick − pr.born. Todos os testes usam a posição depois de andar no tick (como a ROM: $C1:29C2 anda,
 *  depois testa).
 *  - `spawn`: deslocamento no próprio tick do Y (k = 0). A ROM já desenha E/D em X + 2 e F em X + 1 nesse quadro.
 *  - `seg`: ticks por casa andada (16 px). A rota da ROM ($C1:29C2) acaba a cada `seg` ticks ($AC ≠ 0) e só então a
 *    casa da frente é testada; em k ≡ seg − 1 (mod seg), contado do tick do Y.
 *  - `center` (F): bloco, bomba parada, item ou caveira na casa do centro também acabam o voo ($C1:303C).
 *  - `frontRoll` (E): bomba rolando na casa da frente também conta no fim de cada casa ($C1:2E56).
 *  - `burst` (D): um adversário na casa da frente conta como bloqueio. O míssil para no centro da casa atual e só
 *    devolve o resultado (a explosão) no tick seguinte. */
export interface ProjSpec { speed: number; spawn: number; seg: number; center: boolean; frontRoll: boolean; burst: boolean }
export type ProjResult = { kind: 'none' } | { kind: 'player'; slot: number } | { kind: 'block'; cell: number };

/** Borda da frente do míssil D: a casa em (x ± 8 px) é a que ele está prestes a invadir. */
export const FRONT = 8 * 256;
export const D_SPEC: ProjSpec = { speed: 512, spawn: 512, seg: 8, center: false, frontRoll: false, burst: true };
export const E_SPEC: ProjSpec = { speed: 512, spawn: 512, seg: 8, center: false, frontRoll: true, burst: false };
export const F_SPEC: ProjSpec = { speed: 128, spawn: 256, seg: 32, center: true, frontRoll: false, burst: false };
export const SPEC_OF: Record<ProjKind, ProjSpec> = { 0xd: D_SPEC, 0xe: E_SPEC, 0xf: F_SPEC };

/** Objeto final do tiro E/F: $C1:2EB6 (nuvem do E) ou $C1:30FC (fim da nota) por 39 ticks + $C3:50E8 por 1, ambos
 *  com a anim $D8:D327. O +$C6 do dono só zera nesse último tick ($C1:2ECA / $C1:3110), e o Y só lança de novo com
 *  +$C6 = 0 ($C2:46D0 para o E, $C2:471E para o F). Medido: novo tiro em fim + 40 (F: 31 → 71, 159 → 199, acerto
 *  78 → 118; E: 91 → 131, acerto 11 → 51). */
export const SHOT_END_TICKS = 40;

const AX: Record<number, readonly [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

export function spawnProjectile(s: RoundState, owner: Player, kind: ProjKind, slot: 0 | 1 | 2 = 0): MountProjectile {
  const ms = mstate(s);
  const [ux, uy] = AX[owner.face];
  const d = SPEC_OF[kind].spawn;
  const pr: MountProjectile = {
    id: ms.nextId++, kind, owner: owner.slot, x: owner.x + ux * d, y: owner.y + uy * d, dir: owner.face,
    born: s.tick, state: 'fly', t: s.tick, slot,
  };
  ms.projectiles.push(pr);
  return pr;
}

/** Tiro E/F: ao nascer, a ROM testa a casa da frente do montador ($C1:2D23 / $C1:2F45). Bloqueada → o objeto final
 *  já nasce na posição do montador (medido: de frente para a parede ou para um item, fim em k = 0). */
export function spawnShot(s: RoundState, owner: Player, kind: 0xe | 0xf): MountProjectile {
  const pr = spawnProjectile(s, owner, kind);
  if (frontBlocked(s, neighbor(cellAt(owner.x, owner.y), owner.face))) {
    pr.x = owner.x; pr.y = owner.y;
    pr.state = 'cloud'; pr.t = s.tick;
  }
  return pr;
}

export function hasFlying(s: RoundState, owner: number, kind: ProjKind): boolean {
  return mstate(s).projectiles.some(pr => pr.owner === owner && pr.kind === kind && pr.state === 'fly');
}

/** +$C6 ≠ 0: o tiro E/F do dono ainda está em jogo (em voo ou no objeto final). Só lê o estado (serve à IA). */
export function shotInPlay(s: RoundState, owner: number, kind: 0xe | 0xf): boolean {
  const list = (s.mountState as MountState | null)?.projectiles ?? [];
  return list.some(pr => pr.owner === owner && pr.kind === kind
    && (pr.state === 'fly' || (pr.state === 'cloud' && s.tick - pr.t < SHOT_END_TICKS)));
}

/** 1º adversário do dono (ordem P1..P5) parado na casa `cell`; −1 se não houver. */
function enemyIn(s: RoundState, pr: MountProjectile, cell: number): number {
  if (cell < 0) return -1;
  const own = s.players[pr.owner];
  for (const q of s.players) if (isEnemy(s, own, q) && cellAt(q.x, q.y) === cell) return q.slot;
  return -1;
}

function frontCell(pr: MountProjectile): number {
  const [ux, uy] = AX[pr.dir];
  return cellAt(pr.x + ux * FRONT, pr.y + uy * FRONT);
}

/** Casa vizinha de `cell` na direção `dir`; −1 fora da grade. */
function neighbor(cell: number, dir: number): number {
  if (cell < 0) return -1;
  const [ux, uy] = AX[dir];
  const c = colOf(cell) + ux, l = linOf(cell) + uy;
  return c >= 0 && c < GRID_W && l >= 0 && l < GRID_H ? cellOf(c, l) : -1;
}

const solid = (s: RoundState, cell: number): boolean => cell < 0 || (s.grid[cell] & 0x8000) !== 0;
/** Item ou caveira na grade (`AND #$EFC0` = $0940 / $0980; o ovo $097x também). */
const itemOrSkull = (g: number): boolean => (g & 0xefc0) === CODE.ITEM || (g & 0xefc0) === CODE.SKULL;
/** Teste da casa da frente da ROM: bit 15 (bloco, parede, bomba parada $C900, queima), item ou caveira. */
const frontBlocked = (s: RoundState, cell: number): boolean => solid(s, cell) || itemOrSkull(s.grid[cell]);
/** Chama na casa (`BIT #$1000`: $1000 e o pad com chama $1C00). */
const flameIn = (s: RoundState, cell: number): boolean => cell >= 0 && (s.grid[cell] & CODE.FLAME) !== 0;
/** Bomba rolando: a ROM a marca com $4000 no mapa de ocupação $7F:1000 na casa do centro ($C1:37C4; medido no chute)
 *  e a tira da grade enquanto rola. */
function rollingIn(s: RoundState, cell: number): boolean {
  return cell >= 0 && s.bombs.some(b => b.state === 'kicked' && cellAt(b.x, b.y) === cell);
}

/** Testes de E/F a cada tick, na casa do centro (ordem da ROM: chama, adversário, bomba rolando e, no F, grade) e,
 *  no fim de cada casa andada, na casa da frente. */
function probeShot(s: RoundState, pr: MountProjectile, spec: ProjSpec): ProjResult | null {
  const c = cellAt(pr.x, pr.y);
  if (c < 0) return { kind: 'block', cell: c };
  if (flameIn(s, c)) return { kind: 'block', cell: c };
  const q = enemyIn(s, pr, c);
  if (q >= 0) return { kind: 'player', slot: q };
  if (rollingIn(s, c)) return { kind: 'block', cell: c };
  if (spec.center && frontBlocked(s, c)) return { kind: 'block', cell: c };
  if ((s.tick - pr.born + 1) % spec.seg === 0) {
    const f = neighbor(c, pr.dir);
    if (frontBlocked(s, f) || (spec.frontRoll && rollingIn(s, f))) return { kind: 'block', cell: c };
  }
  return null;
}

/** D: casa da frente sólida, com item/caveira ou com adversário → para no centro da casa atual. Chama ou bomba
 *  rolando na casa do centro ($C1:3349 / $C1:3350) também param. O marcador é pr.t > pr.born. */
function probeBurst(s: RoundState, pr: MountProjectile): void {
  const c = cellAt(pr.x, pr.y);
  const f = frontCell(pr);
  if (!flameIn(s, c) && !rollingIn(s, c) && !frontBlocked(s, f) && enemyIn(s, pr, f) < 0) return;
  pr.x = centerX(colOf(c)); pr.y = centerY(linOf(c));
  pr.t = s.tick;
}

/** Um tick de voo (chamado com k ≥ 1). Devolve o que aconteceu neste tick. */
export function advanceProjectile(s: RoundState, pr: MountProjectile, spec: ProjSpec): ProjResult {
  if (spec.burst && pr.t > pr.born) {                       // parou no tick anterior (no centro): explode agora
    const c = cellAt(pr.x, pr.y);
    const [ux, uy] = AX[pr.dir];
    const nc = colOf(c) + ux, nl = linOf(c) + uy;
    const q = nc >= 0 && nc < GRID_W && nl >= 0 && nl < GRID_H ? enemyIn(s, pr, cellOf(nc, nl)) : -1;
    return q >= 0 ? { kind: 'player', slot: q } : { kind: 'block', cell: c };
  }
  const [ux, uy] = AX[pr.dir];
  pr.x += ux * spec.speed;
  pr.y += uy * spec.speed;
  if (spec.burst) { probeBurst(s, pr); return { kind: 'none' }; }
  return probeShot(s, pr, spec) ?? { kind: 'none' };
}
