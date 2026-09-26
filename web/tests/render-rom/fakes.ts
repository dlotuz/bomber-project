import type { Anim, AnimFrame, ArenaAssets, CharacterAssets, RomAssets, Tiles } from '../../src/rom/types';
import type { RomView } from '../../src/rom/view';
import { defaultRules, emptyRound, type RoundState } from '../../src/core';

const le16 = (w: number) => [w & 0xff, (w >> 8) & 0xff];
const le24 = (a: number) => [a & 0xff, (a >> 8) & 0xff, (a >> 16) & 0xff];

/** `count` tiles 8×8; o tile t fica todo com o índice fill(t). */
export function fakeTiles(count: number, fill: (tile: number) => number = () => 0): Tiles {
  const px = new Uint8Array(count * 64);
  for (let t = 0; t < count; t++) px.fill(fill(t), t * 64, t * 64 + 64);
  return { bpp: 4, count, px };
}

/** RomView falso: memória esparsa em endereços SNES. */
export function fakeRom(bytes: Record<number, number[]>): RomView {
  const mem = new Map<number, number>();
  for (const [a, list] of Object.entries(bytes)) list.forEach((b, i) => mem.set(Number(a) + i, b));
  const u8 = (a: number) => mem.get(a) ?? 0;
  const u16 = (a: number) => u8(a) | (u8(a + 1) << 8);
  const p24 = (a: number) => u16(a) | (u8(a + 2) << 16);
  return { u8, u16, u24: p24, p24, bytes: (a: number, n: number) => Uint8Array.from({ length: n }, (_, i) => u8(a + i)) } as unknown as RomView;
}

export const FAKE_ITEM_WORDS: Readonly<Record<number, number>> = { 0x01: 0x1280, 0x03: 0x1282, 0x21: 0x128a };
const ANIM_TABS = [0xc276c5, 0xc27515, 0xc27665, 0xc2755d, 0xc2746d, 0xc2749d, 0xc26ce8, 0xc26f71, 0xc26e15, 0xc26f05, 0xc26f35, 0xc26fc5];
const DIRECT = new Set([0xc26e15, 0xc26f05]);

/** Endereço sintético da animação: $D8:kkii (k = tabela, ii = índice; direta = $FF). O 1º quadro padrão usa g = ii. */
export function fakeAnimAddr(tab: number, idx: number | null): number {
  return 0xd80000 | (ANIM_TABS.indexOf(tab) << 8) | (idx ?? 0xff);
}
export const fr = (dur: number, g: number, mx = 0, my = 0, big = true): AnimFrame =>
  ({ dur, mx, my, pieces: [{ dx: -16, dy: -24, tile: g, hflip: false, vflip: false, big, palAdd: 0 }] });
export const FAKE_ANIMS = new Map<number, Anim>([
  [fakeAnimAddr(0xc26e15, null), [fr(5, 24), fr(5, 25), fr(6, 26), fr(6, 27)]],   // morte
  [fakeAnimAddr(0xc276c5, 1), [fr(12, 4), fr(8, 3), fr(12, 5), fr(8, 3)]],        // andar →
]);
export const NORMAL_BOMB = [{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }, { word: 0x0b04, dur: 16 }, { word: 0x0b06, dur: 16 }];
export const REMOTE_BOMB = [0x0b08, 0x0b0a, 0x0b0c, 0x0b0e].map(word => ({ word, dur: 16 }));

export function fakeRomBytes(): Record<number, number[]> {
  const b: Record<number, number[]> = {};
  const items: number[] = [];
  for (let id = 0; id < 0x30; id++) items.push(...le16(FAKE_ITEM_WORDS[id] ?? 0x1200 + id), 0x40 + id, 0x09);
  b[0xc15fe0] = items;
  const crowns: number[] = [];
  for (let n = 0; n < 10; n++) crowns.push(...le16(0x2640 + n));
  b[0xc45d11] = crowns;
  const team: number[] = [];
  for (let k = 0; k < 8 * 8; k++) team.push(...le24(0xc01000), 0);
  b[0xc27b9d] = team;
  b[0xc01000] = Array.from({ length: 16 }, (_, i) => le16(0x0100 + i)).flat();
  ANIM_TABS.forEach((tab, k) => {
    const second = 0xe10000 | (k << 8);
    b[tab] = Array.from({ length: 8 }, () => le24(DIRECT.has(tab) ? fakeAnimAddr(tab, null) : second)).flat();
    if (!DIRECT.has(tab)) b[second] = Array.from({ length: 16 }, (_, i) => le24(fakeAnimAddr(tab, i))).flat();
  });
  return b;
}

export function fakeArena(stage: number, over: Partial<ArenaAssets> = {}): ArenaAssets {
  const hud = new Uint16Array(96).fill(0x260b);
  for (let r = 0; r < 3; r++) hud[r * 32 + 5] = 0x263a + 0x10 * r;
  return {
    stage, bgTiles: fakeTiles(1024, t => t & 0xff), bgCgram: Uint16Array.from({ length: 128 }, (_, i) => i),
    bg1: new Uint16Array(1024), bg2Base: Uint16Array.from({ length: 1024 }, (_, i) => 0x2000 | i),
    floor: Uint16Array.from({ length: 1024 }, (_, i) => 0x1000 | i), logicBase: new Uint16Array(1024),
    tileAnim: null, palAnim: [], colorMath: 'none', hudMap: hud,
    bg3Font: fakeTiles(0), bg3Banners: fakeTiles(0), objCommon: fakeTiles(512),
    objCgram: Uint16Array.from({ length: 128 }, (_, i) => 0x4000 + i), record: 0, removeN: 0, ...over,
  } as unknown as ArenaAssets;
}

export function fakeCharacter(c: number): CharacterAssets {
  const frames = new Map<number, Uint8Array>();
  return {
    frame: (g: number) => {
      let f = frames.get(g);
      if (!f) { f = new Uint8Array(1024).fill((g & 15) || 1); frames.set(g, f); }
      return f;
    },
    palettes: [0, 1, 2, 3, 4].map(slot => Uint16Array.from({ length: 16 }, (_, i) => (c << 12) | (slot << 8) | i)),
    victoryFrame: () => new Uint8Array(1024),
    hudHead: (_slot: number) => fakeTiles(6, t => 0x40 + 8 * c + t),
  } as unknown as CharacterAssets;
}

export function fakeAssets(opt: { arena?: Partial<ArenaAssets>; arenaThrows?: boolean } = {}): RomAssets {
  const rom = fakeRom(fakeRomBytes());
  const arenas = new Map<number, ArenaAssets>();
  const chars = new Map<number, CharacterAssets>();
  const anim = (addr: number): Anim => FAKE_ANIMS.get(addr) ?? [fr(255, addr & 0xff)];
  const fail = () => { throw new Error('não usado nos testes do plano 7'); };
  return {
    rom,
    arena: (n: number) => {
      if (opt.arenaThrows) throw new Error('arena falsa com defeito');
      let a = arenas.get(n);
      if (!a) { a = fakeArena(n, opt.arena); arenas.set(n, a); }
      return a;
    },
    character: (c: number) => {
      let ch = chars.get(c);
      if (!ch) { ch = fakeCharacter(c); chars.set(c, ch); }
      return ch;
    },
    anim,
    playerAnim: (tab: number, _c: number, idx: number) => anim(fakeAnimAddr(tab, idx)),
    bombScript: (t: number) => (t === 1 ? REMOTE_BOMB : NORMAL_BOMB),
    scene: fail, mode7Draw: fail, audioData: fail,
  } as unknown as RomAssets;
}

/** Rodada vazia do núcleo (paredes + pilares), já em `play`. */
export function fakeRound(over: Partial<RoundState> = {}): RoundState {
  const s = emptyRound(1, defaultRules());
  s.phase = 'play';
  return Object.assign(s, over);
}

export function blankImage(): ImageData {
  return { width: 256, height: 224, data: new Uint8ClampedArray(256 * 224 * 4), colorSpace: 'srgb' } as ImageData;
}
