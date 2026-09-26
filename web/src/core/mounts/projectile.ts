import type { RoundState, Player } from '../types';
import { mstate, type MountProjectile, type ProjKind } from './types';
import { cellAt, cellOf, colOf, linOf, centerX, centerY, GRID_W, GRID_H, isEnemy } from './core-api';

/** Modelo por casas medido no emulador (relatório da T3 do plano 9). Posições em 1/256 px; k = s.tick − pr.born.
 *  - `spawn`: deslocamento no próprio tick do Y (k = 0). A ROM já desenha E/D em X + 2 e F em X + 1 nesse quadro.
 *  - `early`: os testes usam a posição do começo do tick, antes de andar (F). Caso contrário (E, D), depois de andar.
 *  - `burst` (D): um adversário na casa da frente conta como bloqueio. O míssil para no centro da casa atual e só
 *    devolve o resultado (a explosão) no tick seguinte. */
export interface ProjSpec { speed: number; spawn: number; early: boolean; burst: boolean }
export type ProjResult = { kind: 'none' } | { kind: 'player'; slot: number } | { kind: 'block'; cell: number };

/** Borda da frente do projétil: a casa em (x ± 8 px) é a que ele está prestes a invadir. */
export const FRONT = 8 * 256;
export const D_SPEC: ProjSpec = { speed: 512, spawn: 512, early: false, burst: true };
export const E_SPEC: ProjSpec = { speed: 512, spawn: 512, early: false, burst: false };
export const F_SPEC: ProjSpec = { speed: 128, spawn: 256, early: true, burst: false };
export const SPEC_OF: Record<ProjKind, ProjSpec> = { 0xd: D_SPEC, 0xe: E_SPEC, 0xf: F_SPEC };

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

export function hasFlying(s: RoundState, owner: number, kind: ProjKind): boolean {
  return mstate(s).projectiles.some(pr => pr.owner === owner && pr.kind === kind && pr.state === 'fly');
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

const solid = (s: RoundState, cell: number): boolean => cell < 0 || (s.grid[cell] & 0x8000) !== 0;

/** Testes de E/F: acerta quem está na casa do projétil; bloqueia quando a borda da frente entra numa casa sólida. */
function probeHit(s: RoundState, pr: MountProjectile): ProjResult | null {
  const c = cellAt(pr.x, pr.y);
  const q = enemyIn(s, pr, c);
  if (q >= 0) return { kind: 'player', slot: q };
  if (solid(s, frontCell(pr))) return { kind: 'block', cell: c };
  return null;
}

/** D: casa da frente sólida ou com adversário → para no centro da casa atual. O marcador é pr.t > pr.born. */
function probeBurst(s: RoundState, pr: MountProjectile): void {
  const f = frontCell(pr);
  if (!solid(s, f) && enemyIn(s, pr, f) < 0) return;
  const c = cellAt(pr.x, pr.y);
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
  if (spec.early) { const r = probeHit(s, pr); if (r) return r; }
  const [ux, uy] = AX[pr.dir];
  pr.x += ux * spec.speed;
  pr.y += uy * spec.speed;
  if (spec.burst) probeBurst(s, pr);
  else if (!spec.early) { const r = probeHit(s, pr); if (r) return r; }
  return { kind: 'none' };
}
