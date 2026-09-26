import { itemBlinkColor, palFrameAt, tileStateAt, tileTimeline, type TileCmd } from '../../src/render/anim/timeline';
import { normTileCmds, sceneryCgram, sceneryTiles } from '../../src/render/rom/scenery';
import type { PalAnim, TileAnimCmd } from '../../src/rom/types';
import { fakeArena } from './fakes';

const dma = (dst: number, src: number): TileCmd => ({ op: 'dma', dst, src });
const wait = (n: number): TileCmd => ({ op: 'wait', n });
const ARENA7: TileCmd[] = [dma(2, 0xe0), wait(10), dma(2, 0xe2), wait(10), dma(2, 0xe4), wait(10), dma(2, 0xe6), wait(10), { op: 'loop' }];

describe('linha do tempo de tiles (D5)', () => {
  it('arena 7: soft block troca a cada 12 ticks, ciclo de 48', () => {
    const tl = tileTimeline(ARENA7);
    expect(tl.events.map(e => e.t)).toEqual([0, 12, 24, 36]);
    expect(tl.period).toBe(48);
    const src = (t: number) => tileStateAt(tl, t).get(2) ?? null;
    expect([0, 1, 12, 13, 25, 37, 48, 49, 61].map(src)).toEqual([null, 0xe0, 0xe0, 0xe2, 0xe4, 0xe6, 0xe6, 0xe0, 0xe2]);
  });
  it('vários DMAs seguidos gastam 1 tick cada; o loop não gasta', () => {
    const tl = tileTimeline([dma(0xe0, 0x100), dma(0x44, 0x180), wait(10), dma(0xe0, 0x108), dma(0x44, 0x1a0), wait(10), { op: 'loop' }]);
    expect(tl.events.map(e => e.t)).toEqual([0, 1, 13, 14]);
    expect(tl.period).toBe(26);
    expect([...tileStateAt(tl, 14)]).toEqual([[0xe0, 0x108], [0x44, 0x180]]);
    expect([...tileStateAt(tl, 27)]).toEqual([[0xe0, 0x100], [0x44, 0x1a0]]);
  });
  it('fim ($90): o último estado fica', () => {
    const tl = tileTimeline([dma(5, 9), { op: 'end' }, dma(5, 10)]);
    expect(tl.period).toBeNull();
    expect([...tileStateAt(tl, 1000)]).toEqual([[5, 9]]);
  });
  it('conversão do formato do plano 5: VRAM >> 4 e $7F:xxxx → tile', () => {
    const cmds = [{ kind: 'dma', vram: 0x20, src: 0x7f9c00 }, { kind: 'wait', frames: 10 }, { kind: 'dma', vram: 0xe00, src: 0x7fa000 },
      { kind: 'loop' }] as unknown as TileAnimCmd[];
    expect(normTileCmds(cmds)).toEqual([dma(2, 0xe0), wait(10), dma(0xe0, 0x100), { op: 'loop' }]);
  });
});

describe('paletas e pisca', () => {
  it('quadro da paleta = ⌊tick/período⌋ mod N', () => {
    const f = [new Uint16Array(16).fill(1), new Uint16Array(16).fill(2), new Uint16Array(16).fill(3)];
    const p = { index: 80, frames: f, period: 14 };
    expect([0, 13, 14, 28, 42].map(t => palFrameAt(p, t)[0])).toEqual([1, 1, 2, 3, 1]);
  });
  it('itens: cor 79 = $00BF / $7D80, 4 frames cada', () => {
    expect([0, 3, 4, 7, 8].map(itemBlinkColor)).toEqual([0x00bf, 0x00bf, 0x7d80, 0x7d80, 0x00bf]);
  });
});

describe('tiles e CGRAM do quadro', () => {
  const anim7 = [{ kind: 'dma', vram: 0x20, src: 0x7f9c00 }, { kind: 'wait', frames: 10 }, { kind: 'dma', vram: 0x20, src: 0x7f9c40 },
    { kind: 'wait', frames: 10 }, { kind: 'loop' }] as unknown as TileAnimCmd[];
  const tileAt = (px: Uint8Array, t: number) => px[t * 64];

  it('aplica o quadro de animação sem mexer no buffer original', () => {
    const ar = fakeArena(7, { tileAnim: anim7 });
    expect(tileAt(sceneryTiles(ar, 0, [], '').px, 2)).toBe(2);
    const t1 = sceneryTiles(ar, 1, [], '').px;
    expect([2, 3, 18, 19].map(t => tileAt(t1, t))).toEqual([0xe0, 0xe1, 0xf0, 0xf1]);
    expect(tileAt(sceneryTiles(ar, 13, [], '').px, 2)).toBe(0xe2);
    expect(tileAt(ar.bgTiles.px, 2)).toBe(2);
  });
  it('cache: mesmo estado → mesmo objeto; trocas extras (rostos) e cópias fixas (golden)', () => {
    const ar = fakeArena(7, { tileAnim: anim7 });
    expect(sceneryTiles(ar, 1, [], '')).toBe(sceneryTiles(ar, 5, [], ''));
    const extra = [{ tile: 0x201, px: new Uint8Array(64).fill(9) }];
    expect(tileAt(sceneryTiles(ar, 1, extra, 'k').px, 0x201)).toBe(9);
    expect(tileAt(sceneryTiles(ar, 1, [], '', [[2, 0xe4]]).px, 2)).toBe(0xe4);
  });
  it('CGRAM: BG + animação de paleta + pisca; OBJ; OBJ pal 2 = BG pal 4', () => {
    const palAnim = [{ first: 80, frames: [new Uint16Array(16).fill(0x1111), new Uint16Array(16).fill(0x2222)], period: 14 }] as unknown as PalAnim[];
    const ar = fakeArena(9, { palAnim });
    const cg = sceneryCgram(ar, 14, 4, true);
    expect([cg[10], cg[80], cg[95], cg[96], cg[79], cg[128], cg[255]]).toEqual([10, 0x2222, 0x2222, 96, 0x7d80, 0x4000, 0x407f]);
    expect(Array.from(cg.slice(160, 176))).toEqual(Array.from(cg.slice(64, 80)));
    expect(sceneryCgram(ar, 0, 4, false)[79]).toBe(79);
  });
});
