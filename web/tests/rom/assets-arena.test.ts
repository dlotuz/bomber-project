import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadArena, objCommonBytes, arenaTileBytes, arenaBgCgram } from '../../src/rom/assets-arena';
import { buildArena, staticObjects, applyStatic, fallbackList } from '../../src/rom/arena-build';
import { tileAnimKey } from '../../src/rom/decode/tileanim';
import { decodeMapCodes } from '../../src/rom/decode/tilemap';
import type { Tiles } from '../../src/rom/types';

interface ArenaFx {
  arena: number; record: number; script: number; removeN: number; colorMath: string; tilesLoadedSha1: string;
  bg1: { used: number; sha1: string }; bg2Base: { used: number; sha1: string }; floor: { used: number; sha1: string };
  logicBaseSha1: string;
  build: { seedIn: number; seedOut: number; soft: number; bg2Sha1: string; logicSha1: string; floorSha1: string };
  staticBg2Sha1: string; tileAnim: { addr: number; count: number; key: string } | null;
}
interface Fx {
  arenas: ArenaFx[]; hud: { baseSha1: string; startSha1: string };
  fallback: { count: number; first: number[]; sha1: string };
  objCommon: Record<'1' | '3', string>; bg3: { fontSha1: string; bannersSha1: string }; objPal7Sha1: string;
}

/** Re-codifica Tiles 4bpp/2bpp em bytes planares do SNES (para comparar com os hashes dos bytes). */
function encodeTiles(t: Tiles): Uint8Array {
  const size = 8 * t.bpp, out = new Uint8Array(t.count * size);
  for (let n = 0; n < t.count; n++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = t.px[n * 64 + y * 8 + x], bit = 0x80 >> x, b = n * size;
    if (v & 1) out[b + 2 * y] |= bit;
    if (v & 2) out[b + 2 * y + 1] |= bit;
    if (v & 4) out[b + 16 + 2 * y] |= bit;
    if (v & 8) out[b + 17 + 2 * y] |= bit;
  }
  return out;
}

describe.skipIf(!ROM)('ArenaAssets das 10 arenas (gfx-arenas.json)', () => {
  const fx = fixture<Fx>('gfx-arenas.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  for (const e of fx.arenas) it(`arena ${e.arena}`, () => {
    const a = loadArena(view, e.arena);
    expect(a.stage).toBe(e.arena);
    expect(a.record).toBe(e.record);
    expect(a.removeN).toBe(e.removeN);
    expect(a.colorMath).toBe(e.colorMath);
    expect(a.bgTiles.count).toBe(1024);
    expect(sha1Hex(encodeTiles(a.bgTiles))).toBe(e.tilesLoadedSha1);
    expect(sha1Hex(u16le(a.bg1))).toBe(e.bg1.sha1);
    expect(sha1Hex(u16le(a.bg2Base))).toBe(e.bg2Base.sha1);
    expect(sha1Hex(u16le(a.floor))).toBe(e.floor.sha1);
    expect(sha1Hex(u16le(a.logicBase))).toBe(e.logicBaseSha1);
    expect(a.hudMap).toHaveLength(96);
    expect(sha1Hex(u16le(a.hudMap))).toBe(fx.hud.baseSha1);
    if (e.tileAnim) expect(sha1Hex(tileAnimKey(a.tileAnim!))).toBe(e.tileAnim.key);
    else expect(a.tileAnim).toBeNull();
    expect(a.tileAnim?.length ?? null).toBe(e.tileAnim?.count ?? null);
    expect(sha1Hex(encodeTiles(a.objCommon))).toBe(e.arena === 3 ? fx.objCommon['3'] : fx.objCommon['1']);
    expect(sha1Hex(encodeTiles(a.bg3Font))).toBe(fx.bg3.fontSha1);
    expect(sha1Hex(encodeTiles(a.bg3Banners))).toBe(fx.bg3.bannersSha1);
    expect(sha1Hex(u16le(a.objCgram.subarray(112)))).toBe(fx.objPal7Sha1);
    expect([...a.objCgram.subarray(0, 112)].every(v => v === 0)).toBe(true);
  });
  it('mapas: bytes consumidos pelo decodificador', () => {
    for (const e of fx.arenas) {
      const rec = { bg1: view.p24(e.record + 3), bg2: view.p24(e.record + 9), floor: view.p24(e.record + 0x0c) };
      expect([decodeMapCodes(view, rec.bg1).used, decodeMapCodes(view, rec.bg2).used, decodeMapCodes(view, rec.floor).used])
        .toEqual([e.bg1.used, e.bg2Base.used, e.floor.used]);
    }
  });
  it('carga com semente $C689 e 5 jogadores = arena_rom.build_arena (80/80/80/70/0/80/62/0/78/80)', () => {
    expect(fx.arenas.map(e => e.build.soft)).toEqual([80, 80, 80, 70, 0, 80, 62, 0, 78, 80]);
    for (const e of fx.arenas) {
      const b = buildArena(view, e.arena, e.build.seedIn);
      expect({ seed: b.seed, soft: b.soft }).toEqual({ seed: e.build.seedOut, soft: e.build.soft });
      expect(sha1Hex(u16le(b.bg2))).toBe(e.build.bg2Sha1);
      expect(sha1Hex(u16le(b.logic))).toBe(e.build.logicSha1);
      expect(sha1Hex(u16le(b.floor))).toBe(e.build.floorSha1);
      applyStatic(b.bg2, staticObjects(view, e.arena));
      expect(sha1Hex(u16le(b.bg2))).toBe(e.staticBg2Sha1);
    }
  });
  it('lista $C4:1327: 113 casas', () => {
    const fb = fallbackList(view);
    expect(fb).toHaveLength(fx.fallback.count);
    expect(fb.slice(0, 3)).toEqual(fx.fallback.first);
    expect(sha1Hex(u16le(Uint16Array.from(fb)))).toBe(fx.fallback.sha1);
  });
  it('setas da arena 7 e pads da arena 8 nas casas da spec §4.6/§4.7', () => {
    const cell = (o: { off: number }) => [(o.off >> 1) % 32, (o.off >> 1) >> 5];   // (col, lin)
    expect(staticObjects(view, 7).map(o => [...cell(o), o.word])).toEqual([[4, 3, 0x1cc2], [4, 9, 0x1cc0], [12, 3, 0x1cc4], [12, 9, 0x1cc6]]);
    expect(staticObjects(view, 8).map(cell)).toEqual([[4, 7], [8, 7], [12, 7]]);
  });
  it('OBJ comuns: 16 KB', () => {
    expect(objCommonBytes(view, 1)).toHaveLength(0x4000);
  });
});

describe.skipIf(!ROM)('BG das arenas × decomp.py (gfx-formats.json)', () => {
  const fx = fixture<{ arenaUploads: { arena: number; upload: 1 | 2; sha1: string }[]; arenaPalettes: { arena: number; sha1: string }[] }>('gfx-formats.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('11 envios de 32 KB (o 2º da arena 9 depois de arena9Post)', () => {
    expect(fx.arenaUploads).toHaveLength(11);
    for (const u of fx.arenaUploads) expect(sha1Hex(arenaTileBytes(view, u.arena, u.upload))).toBe(u.sha1);
  });
  it('paletas de BG das 10 arenas (CGRAM 0–127 com a correção $C4:4E2F)', () => {
    for (const p of fx.arenaPalettes) expect(sha1Hex(u16le(arenaBgCgram(view, p.arena)))).toBe(p.sha1);
  });
});
