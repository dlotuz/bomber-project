// PPU de software (spec §2.4): PpuFrame → ImageData 256×224. Sem DOM; roda no Node.
import type { BgLayer, Mode7Layer, ObjEntry, PpuFrame, ScanBand } from './types';

const W = 256;
const BG1 = 1, BG2 = 2, BG3 = 4, OBJ = 16, BACK = 32;
// Posto na ordem de prioridade do modo 1 com BG3 alto (menor = na frente) [ANI §1.4, ARN §2.1].
const RANK_BG1 = [5, 2], RANK_BG2 = [6, 3], RANK_BG3 = [8, 0], RANK_OBJ = [9, 7, 4, 1];
// Modo 7: OBJ3 > OBJ2 > OBJ1 > BG1 > OBJ0.
const RANK7_BG1 = 3, RANK7_OBJ = [4, 2, 1, 0];

// Buffers de linha reaproveitados: índice na CGRAM + 1 (0 = transparente) e prioridade.
const l1 = new Int16Array(W), l2 = new Int16Array(W), l3 = new Int16Array(W), lo = new Int16Array(W);
const p1 = new Uint8Array(W), p2 = new Uint8Array(W), p3 = new Uint8Array(W), po = new Uint8Array(W), pal = new Uint8Array(W);
const pal32 = new Uint32Array(256);

function mod(a: number, n: number): number { return ((a % n) + n) % n; }

function bgLine(L: BgLayer, tile16: boolean, hofs: number, vofs: number, y: number, out: Int16Array, pri: Uint8Array): void {
  const ts = tile16 ? 16 : 8, sh = tile16 ? 4 : 3, mapW = L.mapW, mapH = (L.map.length / mapW) | 0;
  const by = mod(y + vofs + 1, mapH * ts), row = by >> sh, fy = by & (ts - 1), wpx = mapW * ts;
  const px = L.tiles.px, count = L.tiles.count, two = L.tiles.bpp === 2, map = L.map, rowBase = row * mapW;
  // bx avança 1 por pixel com volta no fim do mapa (sem `mod`/divisão por pixel: é o laço mais quente da PPU)
  for (let x = 0, bx = mod(hofs, wpx); x < W; x++, bx = bx + 1 === wpx ? 0 : bx + 1) {
    const e = map[rowBase + (bx >> sh)];
    let fx = bx & (ts - 1), gy = fy;
    if (e & 0x4000) fx = ts - 1 - fx;
    if (e & 0x8000) gy = ts - 1 - gy;
    let t = e & 0x3ff;
    if (tile16) t = (t + (fx >> 3) + 16 * (gy >> 3)) & 0x3ff;
    const v = t < count ? px[t * 64 + (gy & 7) * 8 + (fx & 7)] : 0;
    if (v) { const p = (e >> 10) & 7; out[x] = (two ? p * 4 + v : p * 16 + v) + 1; pri[x] = (e >> 13) & 1; }
    else out[x] = 0;
  }
}

function objLine(f: PpuFrame, y: number): void {
  lo.fill(0);
  const tiles = f.objTiles;
  // Do maior índice para o menor: o índice menor sobrescreve e fica na frente, qualquer que seja a prioridade.
  for (let i = f.oam.length - 1; i >= 0; i--) {
    const e: ObjEntry = f.oam[i], size = e.size;
    let sy = y - e.y;
    if (sy < 0 || sy >= size) continue;
    if (e.vflip) sy = size - 1 - sy;
    for (let sx = 0; sx < size; sx++) {
      const X = e.x + sx;
      if (X < 0 || X >= W) continue;
      const fx = e.hflip ? size - 1 - sx : sx;
      let v = 0;
      if ('px' in e.src) v = e.src.px[sy * size + fx];
      else if (tiles) {
        const n = e.src.tile;
        const t = (n & 0x100) | ((((n >> 4) + (sy >> 3)) & 0xf) << 4) | ((n + (fx >> 3)) & 0xf);
        v = t < tiles.count ? tiles.px[t * 64 + (sy & 7) * 8 + (fx & 7)] : 0;
      }
      if (v) { lo[X] = 128 + e.pal * 16 + v + 1; po[X] = e.prio; pal[X] = e.pal; }
    }
  }
}

function m7Line(m: Mode7Layer, y: number, out: Int16Array): void {
  const sy = y + m.vofs - m.cy;
  for (let x = 0; x < W; x++) {
    const sx = x + m.hofs - m.cx;
    let u = ((m.a * sx + m.b * sy) >> 8) + m.cx, v = ((m.c * sx + m.d * sy) >> 8) + m.cy;
    if (u < 0 || u >= 1024 || v < 0 || v >= 1024) {
      if (m.outside === 'transparent') { out[x] = 0; continue; }
      u &= 1023; v &= 1023;
    }
    const c = m.chr[m.map[(v >> 3) * 128 + (u >> 3)] * 64 + (v & 7) * 8 + (u & 7)];
    out[x] = c ? c + 1 : 0;
  }
}

/** Escolhe o pixel da frente entre as camadas da máscara. Devolve o índice na CGRAM + 1 (0 = fundo) e grava a camada em `hit`. */
const hit = { layer: BACK };
function pick(x: number, mask: number, m7: boolean): number {
  let best = 99, idx = 0, layer = BACK;
  if (mask & BG1 && l1[x]) { const r = m7 ? RANK7_BG1 : RANK_BG1[p1[x]]; if (r < best) { best = r; idx = l1[x]; layer = BG1; } }
  if (!m7 && mask & BG2 && l2[x]) { const r = RANK_BG2[p2[x]]; if (r < best) { best = r; idx = l2[x]; layer = BG2; } }
  if (!m7 && mask & BG3 && l3[x]) { const r = RANK_BG3[p3[x]]; if (r < best) { best = r; idx = l3[x]; layer = BG3; } }
  if (mask & OBJ && lo[x]) { const r = m7 ? RANK7_OBJ[po[x]] : RANK_OBJ[po[x]]; if (r < best) { best = r; idx = lo[x]; layer = OBJ; } }
  hit.layer = layer;
  return idx;
}

function rgba(v: number): number {
  const r = v & 31, g = (v >> 5) & 31, b = (v >> 10) & 31;
  return (0xff000000 | (((b << 3) | (b >> 2)) << 16) | (((g << 3) | (g >> 2)) << 8) | ((r << 3) | (r >> 2))) >>> 0;
}

function blend(a: number, b: number, half: boolean): number {
  let r = (a & 31) + (b & 31), g = ((a >> 5) & 31) + ((b >> 5) & 31), bl = ((a >> 10) & 31) + ((b >> 10) & 31);
  if (half) { r >>= 1; g >>= 1; bl >>= 1; } else { r = Math.min(31, r); g = Math.min(31, g); bl = Math.min(31, bl); }
  return r | (g << 5) | (bl << 10);
}

/** Subtração do SNES: canal a canal com piso 0; com `half`, o resultado (já no piso) é dividido por 2. */
function subtract(a: number, b: number, half: boolean): number {
  let r = Math.max(0, (a & 31) - (b & 31)), g = Math.max(0, ((a >> 5) & 31) - ((b >> 5) & 31)), bl = Math.max(0, ((a >> 10) & 31) - ((b >> 10) & 31));
  if (half) { r >>= 1; g >>= 1; bl >>= 1; }
  return r | (g << 5) | (bl << 10);
}

/** Desenha o quadro em `out` (largura fixa `W` = 256 px; a altura vem de `out.height`, normalmente 224). Um
 *  `BgLayer` com `mapW: 64` é lido em `bgLine` como mapa linear (uma faixa contínua de 64 colunas por linha),
 *  não o layout 2×2 telas de 32×32 do hardware SNES — é só como o CAT guarda esses mapas maiores. */
export function renderPpu(f: PpuFrame, out: ImageData): void {
  const px32 = new Uint32Array(out.data.buffer, out.data.byteOffset, W * out.height);
  const back = f.backdrop ?? f.cgram[0];
  for (let i = 0; i < 256; i++) pal32[i] = rgba(f.cgram[i]);
  const backRgba = rgba(back);
  px32.fill(backRgba);
  const m7 = f.mode7;
  for (const band of f.bands as ScanBand[]) {
    const need = band.main | (band.math !== 'none' ? band.sub : 0);
    const mathLayers = band.mathLayers ?? BG1;
    for (let y = Math.max(0, band.y0); y < Math.min(out.height, band.y1); y++) {
      if (m7) { if (need & BG1) m7Line(m7, y, l1); else l1.fill(0); l2.fill(0); l3.fill(0); }
      else {
        if (need & BG1 && f.bg1) bgLine(f.bg1, band.bg1Tile16, band.bg1?.[0] ?? f.bg1.hofs, band.bg1?.[1] ?? f.bg1.vofs, y, l1, p1); else l1.fill(0);
        if (need & BG2 && f.bg2) bgLine(f.bg2, f.bg2.tile16, band.bg2?.[0] ?? f.bg2.hofs, band.bg2?.[1] ?? f.bg2.vofs, y, l2, p2); else l2.fill(0);
        if (need & BG3 && f.bg3) bgLine(f.bg3, f.bg3.tile16, f.bg3.hofs, f.bg3.vofs, y, l3, p3); else l3.fill(0);
      }
      if (need & OBJ) objLine(f, y); else lo.fill(0);
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = pick(x, band.main, !!m7), layer = hit.layer;
        if (band.math !== 'none' && (mathLayers & layer) && (layer !== OBJ || pal[x] >= 4)) {
          const s = pick(x, band.sub, !!m7);
          // Sub transparente: entra a cor fixa (0) e o 'half' não divide → pixel inalterado.
          if (s) {
            const m = i ? f.cgram[i - 1] : back, c = f.cgram[s - 1], op = band.math;
            px32[row + x] = rgba(op === 'sub' || op === 'subHalf' ? subtract(m, c, op === 'subHalf') : blend(m, c, op === 'half'));
            continue;
          }
        }
        px32[row + x] = i ? pal32[i - 1] : backRgba;
      }
    }
  }
}
