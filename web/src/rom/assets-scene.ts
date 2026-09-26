// Telas: VRAM e CGRAM montadas pelos segmentos do catálogo [CAT §5, GFX §4]; Modo 7 do DRAW GAME; fatias do áudio.
import type { AudioRomSlices, SceneAssets, SceneId } from './types';
import type { RomView } from './view';
import { SCENES, type VramSeg } from './catalog';
import { decodeZte } from './decode/zte';
import { decodeM7Rle } from './decode/m7rle';
import { readBgr555 } from './decode/palette';
import { decodeTiles } from './decode/tiles';

/** Bytes de um segmento do catálogo. */
export function segmentBytes(rom: RomView, s: VramSeg, zte: (addr: number) => Uint8Array): Uint8Array {
  let d: Uint8Array;
  if (s.kind === 'zte') d = zte(s.src).subarray(s.offset, s.offset + s.bytes);
  else if (s.kind === 'raw') d = rom.bytes(s.src + s.offset, s.bytes);
  else if (s.kind === 'zero') d = new Uint8Array(s.bytes);
  else d = new Uint8Array(s.bytes).fill(s.value);
  if (d.length !== s.bytes) throw new RangeError(`segmento curto: VRAM $${s.vramByte.toString(16)}`);
  return d;
}

export function loadScene(rom: RomView, id: SceneId, zte: (addr: number) => Uint8Array): SceneAssets {
  const sc = SCENES[id];
  if (!sc) throw new RangeError(`tela desconhecida: ${id}`);
  const vram = new Uint8Array(0x10000), written = new Uint8Array(0x10000);
  for (const s of sc.vram) {
    const d = segmentBytes(rom, s, zte);
    for (let i = 0; i < s.bytes; i++) { const o = (s.vramByte + i) & 0xffff; vram[o] = d[i]; written[o] = 1; }
  }
  const cgram = new Uint16Array(256);
  sc.cgram.forEach((a, i) => cgram.set(readBgr555(rom.bytes(a, 32), 0, 16), 16 * i));
  return { id, vram, written, cgram, bgTiles: decodeTiles(vram, 4, 0, 1024), bg3Tiles: decodeTiles(vram, 2, 0xa000, 512),
    objTiles: decodeTiles(vram, 4, 0xc000, 512) };
}

/** DRAW GAME, fase Modo 7: pixels $CD:9800 + mapa $D6:60D9 → `chr` (256 tiles × 64 bytes) e `map` (128×128). */
export function loadMode7Draw(rom: RomView): { chr: Uint8Array; map: Uint8Array } {
  const v = decodeM7Rle(rom.data, 0xcd9800, 0xd660d9).vram, chr = new Uint8Array(0x4000), map = new Uint8Array(0x4000);
  for (let i = 0; i < 0x4000; i++) { map[i] = v[2 * i]; chr[i] = v[2 * i + 1]; }
  return { chr, map };
}

export const AUDIO_CPU = [0xc00190, 0xc007ea] as const, AUDIO_DATA = [0xd90000, 0xde9c94] as const;
export function audioSlices(rom: RomView): AudioRomSlices {
  const sl = ([a, b]: readonly [number, number]) => ({ base: a, bytes: rom.bytes(a, b - a) });
  return { cpu: sl(AUDIO_CPU), data: sl(AUDIO_DATA) };
}
