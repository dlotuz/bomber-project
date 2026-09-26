// Porta única do plano 10 para rom/, render/ppu, render/rom/battle.ts e audio/sink.ts (plano 5).
// Se um nome do plano 5 mudar, só este arquivo muda.
import { decodeTiles } from '../rom/decode/tiles';
import { decodeZte } from '../rom/decode/zte';
import type { RomAssets, SceneId, Tiles } from '../rom/types';

// forgetStoredRom já existe no plano 5 (forgetRom() + assets = null + status 'vazio' + avisa onRomChange).
export { romState, onRomChange, openRomDialog, forgetStoredRom, useRomBytes } from '../rom/state';
export type { RomState, RomStatus } from '../rom/state';
export type { RomAssets, SceneId, Tiles, Anim, AnimFrame, Piece } from '../rom/types';
export { renderPpu } from '../render/ppu';
export type { PpuFrame, BgLayer, ObjEntry, ScanBand, Mode7Layer } from '../render/ppu';
export { drawRomBattle } from '../render/rom/battle';
export { NoopSink, type AudioSink } from '../audio/sink';

/** VRAM (64 KiB) e CGRAM (256 cores) da cena, montadas pelos segmentos do CAT §5. */
export function sceneVramCgram(a: RomAssets, id: SceneId): { vram: Uint8Array; cgram: Uint16Array } {
  const s = a.scene(id);
  return { vram: s.vram, cgram: s.cgram };
}
/** `count` tiles planares `bpp` a partir de `off` em `bytes` (bytes além do fim contam como 0). */
export function tilesFrom(bytes: Uint8Array, off: number, count: number, bpp: 2 | 4): Tiles {
  return decodeTiles(bytes, bpp, off, count);
}
/** `count` cores BGR555 cruas a partir do endereço SNES `addr`. */
export function readColors(a: RomAssets, addr: number, count: number): Uint16Array {
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) out[i] = a.rom.u16(addr + 2 * i);
  return out;
}
/** BGR555 → RGB 8 bits, c8 = c<<3 | c>>2. */
export function bgr555ToRgba(c: number): [number, number, number] {
  const f = (v: number) => (v << 3) | (v >> 2);
  return [f(c & 31), f((c >> 5) & 31), f((c >> 10) & 31)];
}
/** Bloco ZTE descomprimido no endereço SNES `addr`. */
export function zteBlock(a: RomAssets, addr: number): Uint8Array { return decodeZte(a.rom.data, addr).data; }
