import type { RoundState } from '../../../core/types';
import type { Pix } from '../../art/pix';
import { rider, type MountState } from '../../../core/mounts/types';
import { cellAt, colOf, linOf } from '../../../core/mounts/core-api';
import { mountPix, eggPix, shotPix } from './art';

/** Leitura sem efeito colateral: a camada de desenho nunca deve criar `s.mountState` (isso é papel do
 *  `step()`/`mstate()` da simulação). Uma rodada sem montarias ainda não tocadas fica com `mountState` null. */
const projectilesOf = (s: RoundState) => (s.mountState as MountState | null)?.projectiles ?? [];

/** `front`: montaria de quem está montado — a camada `over` (`fallbackMountFrontLayer`) redesenha a parte de baixo
 *  dela por cima do cavaleiro (a montaria cobre a metade de baixo do jogador, como na ROM). */
export interface FbSprite { key: string; make: () => Pix; x: number; y: number; front?: boolean }

const cellXY = (cell: number) => ({ x: 16 * colOf(cell) - 8, y: 16 * linOf(cell) + 24 });
const faceOf = (d: number): 0 | 2 | 4 | 6 => ((d & 6) as 0 | 2 | 4 | 6);

export function fallbackMountSprites(s: RoundState, frame: number): FbSprite[] {
  const out: FbSprite[] = [];
  const egg = (cell: number, type: number, wob: number) => {
    const k: 0 | 1 = type >= 8 ? 1 : 0, f = wob;
    const { x, y } = cellXY(cell);
    out.push({ key: `egg:${k}:${f}`, make: () => eggPix(k, f), x: x + (f ? 1 : 0), y });
  };
  for (let c = 0; c < s.grid.length; c++) if ((s.grid[c] & 0xfff0) === 0x0970) egg(c, s.grid[c] & 0xf, 0);
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    const here = cellAt(p.x, p.y);
    if (r.phase === 'mounting') { egg(here, r.type, (frame >> 3) & 1); continue; }
    if (r.phase === 'dismount') { if (r.remount) egg(here, r.type, (frame >> 3) & 1); continue; }
    const st = p.moveDir !== 8 ? (frame >> 3) & 1 : 0, f = faceOf(p.face);
    out.push({ key: `mount:${r.type}:${f}:${st}`, make: () => mountPix(r.type, f, st), x: Math.floor(p.x / 256) - 12, y: Math.floor(p.y / 256) - 12, front: true });
    r.reserves.forEach((t, i) => egg(r.trail[i + 1] ?? here, t, 0));
  }
  for (const pr of projectilesOf(s)) {
    if (pr.state === 'done') continue;
    const x = Math.floor(pr.x / 256), y = Math.floor(pr.y / 256), a = (frame >> 2) & 1;
    if (pr.state === 'cloud') { out.push({ key: `shot:${pr.kind.toString(16)}:cloud`, make: () => shotPix(pr.kind, 'cloud', 0), x: x - 8, y: y - 6 }); continue; }
    if (pr.kind === 0xd) out.push({ key: `mount:13:${pr.dir}:${a}`, make: () => mountPix(0xd, pr.dir, a), x: x - 12, y: y - 12 });
    else if (pr.kind === 0xe) out.push({ key: 'shot:e:fly', make: () => shotPix(0xe, 'fly', 0), x: x - 4, y: y - 4 });
    else out.push({ key: `shot:f:fly:${a}`, make: () => shotPix(0xf, 'fly', a), x: x - 4, y: y - 10 + a });
  }
  return out;
}
