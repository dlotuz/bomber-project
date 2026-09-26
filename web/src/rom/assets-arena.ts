// Assets de uma arena [GFX §3.1–3.2, ARN §2.2–2.3, §3, §4]. Porte de arena_rom.arena_gfx + decomp.arena_bg_palettes.
import type { ArenaAssets, PalAnim } from './types';
import type { RomView } from './view';
import { decodeZte } from './decode/zte';
import { compositeFloor } from './decode/composite';
import { arena9Post } from './decode/arena9';
import { readBgr555 } from './decode/palette';
import { decodeTiles } from './decode/tiles';
import { decodeMapCodes, codesToEntries, codesToLogic } from './decode/tilemap';
import { decodeTileAnim } from './decode/tileanim';

export const ARENA_TABLE = 0xc36233;          // 3 bytes por arena (variante 0)
export const HUD_MAP = 0xd68eec, HUD_TABLE = 0xd68f72;
const COLOR_MATH: Record<number, 'half' | 'add'> = { 2: 'half', 6: 'half', 10: 'add' };   // [ARN §2.1]
const PAL_ANIM: Record<number, { addr: number; frames: number; ticks: number }> = {
  9: { addr: 0xd7dddc, frames: 6, ticks: 14 },    // pal. 5, ciclo 84 [ARN §3.2]
  10: { addr: 0xd7e47c, frames: 4, ticks: 15 },   // pal. 5, ciclo 60
};

export interface ArenaRecord {
  addr: number; gfx: number; bg1Map: number; bg1Tbl: number; bg2Map: number; floorMap: number; bg2Tbl: number;
  tileAnim: number; removeN: number;
}

export function arenaRecord(rom: RomView, stage: number): ArenaRecord {
  if (!(stage >= 1 && stage <= 10)) throw new RangeError(`fase inválida: ${stage}`);
  const a = rom.p24(ARENA_TABLE + 3 * (stage - 1));
  return { addr: a, gfx: rom.p24(a), bg1Map: rom.p24(a + 3), bg1Tbl: rom.p24(a + 6), bg2Map: rom.p24(a + 9),
    floorMap: rom.p24(a + 0x0c), bg2Tbl: rom.p24(a + 0x0f), tileAnim: rom.u24(a + 0x12), removeN: rom.u8(a + 0x1e) };
}

/** 32 KB de tiles de BG como o jogo os envia à VRAM: 8 blocos ZTE ($1000 cada) + composição do piso.
 *  `upload` 2 = segundo envio da arena 9 (depois de arena9Post). */
export function arenaTileBytes(rom: RomView, stage: number, upload: 1 | 2 = stage === 9 ? 2 : 1): Uint8Array {
  const r = arenaRecord(rom, stage), buf = new Uint8Array(0x8000);
  for (let i = 0; i < 8; i++) buf.set(decodeZte(rom.data, rom.p24(r.gfx + 3 * i)).data.subarray(0, 0x1000), 0x1000 * i);
  compositeFloor(buf);
  if (upload === 2) arena9Post(buf);
  return buf;
}

/** Tiles 46/47 e 62/63 que o jogo copia de $C5:FE5C na carga (bloco de pressão `082E`) [GFX §3.2]. */
export function patchPressureTiles(rom: RomView, buf: Uint8Array): void {
  const d = decodeZte(rom.data, 0xc5fe5c).data;
  buf.set(d.subarray(0, 64), 46 * 32);
  buf.set(d.subarray(512, 576), 62 * 32);
}

/** CGRAM 0–127 do BG: 8 paletas do script + correção $C4:4E2F (cores 13–15 da pal. 7 → pal. 2 e 3). */
export function arenaBgCgram(rom: RomView, stage: number): Uint16Array {
  const r = arenaRecord(rom, stage), out = new Uint16Array(128);
  for (let i = 0; i < 8; i++) out.set(readBgr555(rom.bytes(rom.p24(r.gfx + 24 + 3 * i), 32), 0, 16), 16 * i);
  for (const k of [13, 14, 15]) { out[32 + k] = out[112 + k]; out[48 + k] = out[112 + k]; }
  return out;
}

export function hudMap(rom: RomView): Uint16Array {
  const e = codesToEntries(rom, decodeMapCodes(rom, HUD_MAP, 96).codes, HUD_TABLE);
  for (let i = 0; i < 96; i++) e[i] = (e[i] + 0x2200) & 0xffff;
  return e;
}

/** OBJ $6000–$7FFF (16 KB) comum à partida [CAT §3]; as vagas 32×32 dos jogadores ficam zeradas. */
export function objCommonBytes(rom: RomView, stage: number): Uint8Array {
  const buf = new Uint8Array(0x4000), z = (a: number) => decodeZte(rom.data, a).data;
  const at = (word: number) => (word - 0x6000) * 2;
  buf.set(z(0xc8fd36).subarray(0, 0x800), at(0x6800));
  buf.set(z(0xd187ce).subarray(0, 0x800), at(0x7000));
  buf.set(z(0xd18f93).subarray(0, 0x800), at(0x7400));
  buf.set(z(0xd1967f).subarray(0, 0x800), at(0x7800));
  buf.set(z(0xc5013b).subarray(0, 0x800), at(0x7c00));
  const box = z(0xc7fea1);
  buf.set(box.subarray(0, 128), at(0x64c0));
  buf.set(box.subarray(512, 640), at(0x65c0));
  if (stage === 3) {                               // $C8:FA44: bolas da arena 3, tiles 0–5 e 16–21 sobre $7C00
    const orb = z(0xc8fa44);
    for (const t of [0, 1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 21]) buf.set(orb.subarray(32 * t, 32 * t + 32), at(0x7c00) + 32 * t);
  }
  return buf;
}

export function loadArena(rom: RomView, stage: number): ArenaAssets {
  const r = arenaRecord(rom, stage);
  const tiles = arenaTileBytes(rom, stage);
  patchPressureTiles(rom, tiles);
  const bg2Codes = decodeMapCodes(rom, r.bg2Map).codes;
  const objCgram = new Uint16Array(128);
  objCgram.set(readBgr555(rom.bytes(0xd7e6dc, 32), 0, 16), 112);
  const pa = PAL_ANIM[stage];
  const palAnim: PalAnim[] = pa ? [{ first: 80, period: pa.ticks,
    frames: Array.from({ length: pa.frames }, (_, k) => readBgr555(rom.bytes(pa.addr + 32 * k, 32), 0, 16)) }] : [];
  return {
    stage, record: r.addr,
    bgTiles: decodeTiles(tiles, 4),
    bgCgram: arenaBgCgram(rom, stage),
    bg1: codesToEntries(rom, decodeMapCodes(rom, r.bg1Map).codes, r.bg1Tbl),
    bg2Base: codesToEntries(rom, bg2Codes, r.bg2Tbl),
    floor: codesToEntries(rom, decodeMapCodes(rom, r.floorMap).codes, r.bg2Tbl),
    logicBase: codesToLogic(rom, bg2Codes),
    removeN: r.removeN,
    tileAnim: r.tileAnim ? decodeTileAnim(rom, r.tileAnim) : null,
    palAnim,
    colorMath: COLOR_MATH[stage] ?? 'none',
    hudMap: hudMap(rom),
    bg3Font: decodeTiles(rom.bytes(0xd1bc16, 1024), 2),
    bg3Banners: decodeTiles(rom.bytes(0xd0f57b, 1024), 2),
    objCommon: decodeTiles(objCommonBytes(rom, stage), 4),
    objCgram,
  };
}
