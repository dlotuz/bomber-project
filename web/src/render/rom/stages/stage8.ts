import { registerRomLayer, type RomBattleBuilder } from '../../battle-layers';
import { CODE, type RoundState } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { st8, PADS, PAD_IDLE } from '../../../core/stages/stage8';
import { A8_REEL_ROWS } from '../../../core/stages/tables';
import { animFrameAt, assetsOf, decodeZteAt, type StageRomAssets } from './romkit';

export const REEL_STRIP = 0xd3817e;     // 🟡 bloco que o script gráfico da arena 8 manda para $7F:9000
export const ITEM_FALL_ANIM = 0xd8d3af;
export const BOMB_FALL_ANIM = 0xd8d3a8;

export const reelRowSources = (pos: number): number[] => [0, 1, 2, 3].map(k => A8_REEL_ROWS[((pos >> 1) + k) & 15]);

/** Tile 4bpp planar SNES (32 bytes) → 64 índices. */
export function tile4bpp(b: Uint8Array, off: number): Uint8Array {
  const out = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    const p0 = b[off + 2 * y], p1 = b[off + 2 * y + 1], p2 = b[off + 16 + 2 * y], p3 = b[off + 17 + 2 * y];
    for (let x = 0; x < 8; x++) {
      const m = 0x80 >> x;
      out[y * 8 + x] = (p0 & m ? 1 : 0) | (p1 & m ? 2 : 0) | (p2 & m ? 4 : 0) | (p3 & m ? 8 : 0);
    }
  }
  return out;
}

/** Janela do rolo (16×32 índices): 4 linhas de 8 px, cada uma com 2 tiles lado a lado da fita. */
export function reelWindowPx(strip: Uint8Array, pos: number): Uint8Array {
  const out = new Uint8Array(16 * 32);
  reelRowSources(pos).forEach((src, k) => {
    const off = src - 0x9000;
    for (let t = 0; t < 2; t++) {
      const tile = tile4bpp(strip, off + 32 * t);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[(k * 8 + y) * 16 + t * 8 + x] = tile[y * 8 + x];
    }
  });
  return out;
}

let stripCache: { a: object; strip: Uint8Array | null } | null = null;
function strip(a: StageRomAssets): Uint8Array | null {
  if (stripCache?.a !== a) {
    let v: Uint8Array | null = null;
    try { v = decodeZteAt(a, REEL_STRIP); } catch { v = null; }
    stripCache = { a, strip: v };
  }
  return stripCache.strip;
}

/** Janelas dos rolos: entradas do mapa (BG1 ou BG2) com tile $104/$106/$108. */
function reelWindows(a: StageRomAssets & { arena?: (n: number) => { bg1: Uint16Array; bg2Base: Uint16Array; bgCgram: Uint16Array } }) {
  const ar = a.arena?.(8);
  if (!ar) return null;
  const found: { x: number; y: number; pal: number }[] = [];
  for (const tileTop of [0x104, 0x106, 0x108]) {
    let hit: { x: number; y: number; pal: number } | null = null;
    for (const map of [ar.bg1, ar.bg2Base]) {
      for (let i = 0; i < 1024 && !hit; i++) if ((map[i] & 0x3ff) === tileTop) hit = { x: 16 * (i & 31) - 8, y: 16 * (i >> 5) + 24, pal: (map[i] >> 10) & 7 };
      if (hit) break;
    }
    if (!hit) return null;
    found.push(hit);
  }
  return { found, cg: ar.bgCgram };
}

function drawReels(s: RoundState, b: RomBattleBuilder, a: StageRomAssets): void {
  const w = reelWindows(a as never);
  const st = strip(a);
  if (!w || !st) return;
  for (let i = 0; i < 16; i++) b.cgram(128 + 48 + i, w.cg[w.found[0].pal * 16 + i]);
  st8(s).reels.forEach((r, i) => {
    const px = reelWindowPx(st, r.pos);
    for (let half = 0; half < 2; half++) {
      b.sprite({ x: w.found[i].x, y: w.found[i].y + 16 * half, size: 16, pal: 3, prio: 3, hflip: false, vflip: false,
        src: { px: px.slice(half * 256, half * 256 + 256) } }, 0, 200 + 2 * i + half);
    }
  });
}

registerRomLayer({
  id: 'stage8',
  draw(s, b, a0) {
    if (s.stage !== 8) return;
    const a = assetsOf(a0);
    b.cgram(0, 0x0000);
    for (const c of PADS) if (s.grid[c] === CODE.PAD) b.setBg2(colOf(c), linOf(c), s.floor[c] || PAD_IDLE);
    drawReels(s, b, a);
    st8(s).falls.forEach((f, n) => {
      const fr = animFrameAt(a.anim(f.kind === 'bomb' ? BOMB_FALL_ANIM : ITEM_FALL_ANIM), s.tick);
      for (const pc of fr.pieces) {
        b.sprite({ x: f.x + pc.dx, y: f.y + pc.dy, size: pc.big ? 32 : 16, pal: (7 + pc.palAdd) & 7, prio: 2,
          hflip: pc.hflip, vflip: pc.vflip, src: { tile: pc.tile } }, f.y, 150 + n);
      }
    });
  },
});
