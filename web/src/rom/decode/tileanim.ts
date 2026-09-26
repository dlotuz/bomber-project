// Script de animação de tiles `rec+$12` [ARN §3.1] ($C4:0ED1). Porte de arena_rom.decode_anim_script.
import type { TileAnimCmd, Tiles } from '../types';
import type { RomView } from '../view';

/** [W:2][op:1]: $A0 espera W; $80 volta ao início; $90 fim; senão [src:2][banco:1] = DMA 16×16 para a palavra W. */
export function decodeTileAnim(rom: RomView, addr: number, max = 400): TileAnimCmd[] {
  const out: TileAnimCmd[] = [];
  let a = addr;
  for (let k = 0; k < max; k++) {
    const w = rom.u16(a), op = rom.u8(a + 2);
    if (op === 0xa0) { out.push({ kind: 'wait', frames: w }); a += 3; }
    else if (op === 0x80) { out.push({ kind: 'loop' }); return out; }
    else if (op === 0x90) { out.push({ kind: 'end' }); return out; }
    else { out.push({ kind: 'dma', vram: w, src: rom.u24(a + 3) }); a += 6; }
  }
  return out;
}

/** Forma canônica (goldens): `w5 d3584,8364032 L`. */
export function tileAnimKey(cmds: TileAnimCmd[]): string {
  return cmds.map(c => c.kind === 'wait' ? `w${c.frames}` : c.kind === 'dma' ? `d${c.vram},${c.src}` : c.kind === 'loop' ? 'L' : 'E').join(' ');
}

/** Aplica um DMA do script a um buffer de 32 KB de tiles 4bpp (bytes, como a VRAM $0000–$7FFF):
 *  64 bytes de `src` → palavra `vram` e 64 bytes de `src+$200` → palavra `vram+$100`. `src` está em `$7F:8000+`. */
export function applyTileDma(vramTiles: Uint8Array, source32k: Uint8Array, cmd: { vram: number; src: number }): void {
  const s = cmd.src - 0x7f8000, d = cmd.vram * 2;
  vramTiles.set(source32k.subarray(s, s + 64), d);
  vramTiles.set(source32k.subarray(s + 0x200, s + 0x240), d + 0x200);
}

/** Mesmo DMA de `applyTileDma`, mas sobre tiles JÁ DECODIFICADOS (índices de cor, 64 por tile em `Tiles.px`) —
 *  para o plano 7 (render por sprites/tiles em vez de bytes crus da VRAM). Copia o bloco 16×16 (tiles `n`, `n+1`,
 *  `n+16`, `n+17`) do tile de origem `(cmd.src − 0x7F8000)/32` para o tile de destino `cmd.vram/16`, dentro do
 *  mesmo `tiles.px` (o buffer `$7F:8000` é uma cópia do envio de 32 KB que também virou `bgTiles`). */
export function applyTileAnimTiles(tiles: Tiles, cmd: { vram: number; src: number }): void {
  const srcTile = (cmd.src - 0x7f8000) / 32, dstTile = cmd.vram / 16;
  // Tira uma cópia de cada bloco de origem antes de escrever: origem e destino podem se sobrepor dentro do
  // mesmo `tiles.px` (ao contrário de `applyTileDma`, que lê de um buffer `$7F:8000` separado da VRAM).
  const blocks = [0, 1, 16, 17].map(off => tiles.px.slice((srcTile + off) * 64, (srcTile + off) * 64 + 64));
  [0, 1, 16, 17].forEach((off, i) => tiles.px.set(blocks[i], (dstTile + off) * 64));
}
