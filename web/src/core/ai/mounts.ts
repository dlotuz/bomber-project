import type { RoundState, Player } from '../types';
import type { AiMountHints } from './hints';
import { rider, mstate, MAX_RESERVES } from '../mounts/types';
import { cellAt, isEnemy } from '../mounts/core-api';
import { rangeOf } from '../constants';

export const MOUNT_Y_RANGE: Readonly<Record<number, number>> = { 0xc: 4, 0xd: 5, 0xe: 3, 0xf: 3 };
const STEP: Readonly<Record<number, number>> = { 0: -17, 2: 1, 4: 17, 6: -1 };

export function eggValue(s: RoundState, p: Player, cell: number): number | null {
  const code = s.grid[cell];
  if ((code & 0xfff0) !== 0x0970) return null;
  const r = rider(p);
  if (!r) return 3;
  if (r.phase === 'riding' && (code & 0xf) < 8 && r.reserves.length < MAX_RESERVES) return 1;
  return 0;
}

export function alignedEnemy(s: RoundState, p: Player, dir: number, maxCells: number): Player | null {
  let c = cellAt(p.x, p.y);
  for (let i = 1; i <= maxCells; i++) {
    c += STEP[dir];
    if (c < 0 || c >= s.grid.length || (s.grid[c] & 0x8000) !== 0) return null;
    for (const q of s.players) if (q.present && isEnemy(s, p, q) && cellAt(q.x, q.y) === c) return q;
  }
  return null;
}

export function lineCells(s: RoundState, p: Player, dir: number, n: number): number[] {
  const out: number[] = [];
  let c = cellAt(p.x, p.y);
  while (out.length < n && c >= 0 && c < s.grid.length && s.grid[c] === 0) { out.push(c); c += STEP[dir]; }
  return out;
}

export function wantMountY(s: RoundState, p: Player, safeWith: (bombCells: number[]) => boolean): { dir: 0 | 2 | 4 | 6 } | null {
  const r = rider(p);
  if (!r || r.phase !== 'riding') return null;
  const range = MOUNT_Y_RANGE[r.type];
  if (!range) return null;
  if (r.type === 0xe && r.cooldown > 0) return null;
  if (r.type === 0xf && mstate(s).projectiles.some(pr => pr.owner === p.slot && pr.kind === 0xf && pr.state === 'fly')) return null;
  if (r.type === 0xc && (p.disease === 0x24 || p.disease === 0x25 || p.bombsFree === 0)) return null;
  const dirs = [p.face, 0, 2, 4, 6].filter((d, i, a) => a.indexOf(d) === i) as (0 | 2 | 4 | 6)[];
  for (const dir of dirs) {
    if (!alignedEnemy(s, p, dir, range)) continue;
    if (r.type === 0xc && !safeWith(lineCells(s, p, dir, p.bombsFree))) continue;
    return { dir };
  }
  return null;
}

/** Rota de fuga depois da linha do C: BFS de até 6 casas por piso livre (as casas da linha bloqueiam, menos a própria)
 *  até uma casa fora da cruz de todas as bombas da linha (alcance rangeOf(p.fire), parando em bit 15). */
export function escapeAfterLine(s: RoundState, p: Player, cells: readonly number[]): boolean {
  const blast = new Set<number>();
  const range = rangeOf(p.fire);
  for (const b of cells) {
    blast.add(b);
    for (const d of [0, 2, 4, 6]) {
      let c = b;
      for (let i = 0; i < range; i++) { c += STEP[d]; if (c < 0 || c >= s.grid.length || (s.grid[c] & 0x8000) !== 0) break; blast.add(c); }
    }
  }
  const start = cellAt(p.x, p.y);
  const line = new Set(cells);
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 0; depth <= 6 && frontier.length; depth++) {
    const next: number[] = [];
    for (const c of frontier) {
      if (!blast.has(c)) return true;
      for (const d of [0, 2, 4, 6]) {
        const n = c + STEP[d];
        if (n < 0 || n >= s.grid.length || seen.has(n) || line.has(n) || s.grid[n] !== 0) continue;
        seen.add(n); next.push(n);
      }
    }
    frontier = next;
  }
  return false;
}

/** AiMountHints do plano 6: useY(s, slot) e eggValue(s, slot, cell). A IA só aperta Y já virada para o alvo. */
export const mountAiHints: AiMountHints = {
  eggValue: (s, slot, cell) => eggValue(s, s.players[slot], cell) ?? 0,
  useY: (s, slot) => {
    const p = s.players[slot];
    const w = wantMountY(s, p, cells => escapeAfterLine(s, p, cells));
    return w !== null && w.dir === p.face;
  },
};
