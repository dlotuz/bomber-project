import { renderPpu, createImage, type PpuFrame, type BgLayer, type ObjEntry, type ScanBand } from '../../src/render/ppu';
import type { Tiles } from '../../src/rom/types';

// ---------- ajudantes ----------
const C = (r: number, g: number, b: number) => r | (g << 5) | (b << 10);           // BGR555 com canais de 5 bits
const c8 = (c: number) => (c << 3) | (c >> 2);
const rgbOf = (v: number) => [c8(v & 31), c8((v >> 5) & 31), c8((v >> 10) & 31)];
/** Tiles com `count` tiles; `set[n]` = conteúdo do tile n (64 índices) ou um número (tile sólido). */
function mk(bpp: 2 | 4, count: number, set: Record<number, number | Uint8Array>): Tiles {
  const px = new Uint8Array(count * 64);
  for (const [n, v] of Object.entries(set)) px.set(typeof v === 'number' ? new Uint8Array(64).fill(v) : v, Number(n) * 64);
  return { bpp, count, px };
}
function dot(v: number, x: number, y: number): Uint8Array { const t = new Uint8Array(64); t[y * 8 + x] = v; return t; }
function layer(tiles: Tiles, cells: Record<string, number>, o: Partial<BgLayer> = {}): BgLayer {
  const map = new Uint16Array(32 * 32);
  for (const [k, e] of Object.entries(cells)) { const [c, r] = k.split(',').map(Number); map[r * 32 + c] = e; }
  return { map, mapW: 32, tiles, tile16: false, hofs: 0, vofs: -1, ...o };
}
const ALL = 1 | 2 | 4 | 16;
function band(o: Partial<ScanBand> = {}): ScanBand { return { y0: 0, y1: 224, bg1Tile16: false, main: ALL, sub: 0, math: 'none', ...o }; }
function palette(entries: Record<number, number>): Uint16Array { const c = new Uint16Array(256); for (const [i, v] of Object.entries(entries)) c[Number(i)] = v; return c; }
function draw(f: Partial<PpuFrame>): ImageData {
  const img = createImage();
  renderPpu({ cgram: new Uint16Array(256), bands: [band()], oam: [], ...f }, img);
  return img;
}
function at(img: ImageData, x: number, y: number): number[] { const i = (y * 256 + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; }
const BLACK = [0, 0, 0];

// ---------- testes ----------
describe('PPU: fundo e faixas', () => {
  it('sem camadas, tudo é a cor 0 da CGRAM; `backdrop` substitui', () => {
    const cg = palette({ 0: C(31, 0, 0) });
    expect(at(draw({ cgram: cg }), 0, 0)).toEqual([255, 0, 0]);
    expect(at(draw({ cgram: cg }), 255, 223)).toEqual([255, 0, 0]);
    expect(at(draw({ cgram: cg, backdrop: C(0, 31, 0) }), 100, 100)).toEqual([0, 255, 0]);
  });
  it('linhas fora das faixas ficam com o fundo', () => {
    const t = mk(4, 2, { 1: 1 }), cg = palette({ 1: C(0, 0, 31) });
    const bg1 = layer(t, Object.fromEntries(Array.from({ length: 32 * 28 }, (_, i) => [`${i % 32},${i >> 5}`, 1])));
    const img = draw({ cgram: cg, bg1, bands: [band({ y0: 10, y1: 20 })] });
    expect(at(img, 0, 5)).toEqual(BLACK);
    expect(at(img, 0, 10)).toEqual(rgbOf(C(0, 0, 31)));
    expect(at(img, 0, 20)).toEqual(BLACK);
  });
});

describe('PPU: BG 8×8', () => {
  const t = mk(4, 2, { 1: dot(1, 0, 0) });
  const cg = palette({ [2 * 16 + 1]: C(0, 0, 31) });
  const blue = rgbOf(C(0, 0, 31));
  it('vofs = registrador: a linha y mostra a linha y + vofs + 1 do BG', () => {
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: -1 }) }), 16, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: 0 }) }), 16, 23)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { vofs: 0 }) }), 16, 24)).toEqual(BLACK);
  });
  it('hofs desloca para a esquerda e dá a volta no mapa', () => {
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: 8 }) }), 8, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: -16 }) }), 32, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': 1 | (2 << 10) }, { hofs: 256 }) }), 16, 24)).toEqual(blue);
  });
  it('h-flip e v-flip do tile', () => {
    const e = 1 | (2 << 10);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0x4000 }) }), 23, 24)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0x8000 }) }), 16, 31)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0xc000 }) }), 23, 31)).toEqual(blue);
    expect(at(draw({ cgram: cg, bg1: layer(t, { '2,3': e | 0xc000 }) }), 16, 24)).toEqual(BLACK);
  });
  it('BG3 2bpp usa a paleta de 4 cores: índice = 4·pal + cor', () => {
    const t2 = mk(2, 2, { 1: 2 }), cg2 = palette({ 14: C(31, 31, 0) });
    expect(at(draw({ cgram: cg2, bg3: layer(t2, { '0,0': 1 | (3 << 10) }) }), 3, 3)).toEqual(rgbOf(C(31, 31, 0)));
  });
});

describe('PPU: tiles 16×16', () => {
  const t = mk(4, 32, { 2: 1, 3: 2, 18: 3, 19: 4 });
  const cg = palette({ 1: C(31, 0, 0), 2: C(0, 31, 0), 3: C(0, 0, 31), 4: C(31, 31, 31) });
  const bg = (e: number) => layer(t, { '1,1': e }, { tile16: true });
  it('o tile n usa n, n+1, n+16 e n+17', () => {
    const img = draw({ cgram: cg, bg2: bg(2) });
    expect([at(img, 16, 16), at(img, 24, 16), at(img, 16, 24), at(img, 31, 31)]).toEqual([1, 2, 3, 4].map(i => rgbOf(cg[i])));
    expect(at(img, 32, 16)).toEqual(BLACK);
  });
  it('o flip vira o bloco 16×16 inteiro', () => {
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0x4000) }), 16, 16)).toEqual(rgbOf(cg[2]));
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0x8000) }), 16, 16)).toEqual(rgbOf(cg[3]));
    expect(at(draw({ cgram: cg, bg2: bg(2 | 0xc000) }), 16, 16)).toEqual(rgbOf(cg[4]));
  });
  it('bg1Tile16 da faixa e scroll por faixa (HUD 8×8 em cima, campo 16×16 embaixo)', () => {
    const t1 = mk(4, 4, { 1: 1 });
    const bg1 = layer(t1, { '0,0': 1 }, { tile16: true, hofs: 99, vofs: 99 });
    const bands = [band({ y0: 0, y1: 24, bg1Tile16: false, bg1: [0, -1] }), band({ y0: 24, y1: 224, bg1Tile16: true, bg1: [0, -25] })];
    const img = draw({ cgram: cg, bg1, bands });
    expect(at(img, 7, 7)).toEqual(rgbOf(cg[1]));     // 8×8: só o tile 1
    expect(at(img, 8, 0)).toEqual(BLACK);
    expect(at(img, 0, 8)).toEqual(BLACK);
    expect(at(img, 0, 24)).toEqual(rgbOf(cg[1]));    // 16×16: linha 0 do mapa em y = 24
    expect(at(img, 8, 24)).toEqual(BLACK);           // tile 2 vazio
  });
});

describe('PPU: prioridades do modo 1 (BG3 alto)', () => {
  // BG1 → cor 17, BG2 → 33, BG3 (2bpp, pal 0) → 1, OBJ pal 0 → 129
  const cg = palette({ 17: C(31, 0, 0), 33: C(0, 31, 0), 1: C(0, 0, 31), 129: C(31, 31, 0) });
  const t4 = mk(4, 2, { 1: 1 }), t2 = mk(2, 2, { 1: 1 });
  type L = 'bg1' | 'bg2' | 'bg3' | 'obj';
  const color: Record<L, number[]> = { bg1: rgbOf(cg[17]), bg2: rgbOf(cg[33]), bg3: rgbOf(cg[1]), obj: rgbOf(cg[129]) };
  function top(layers: Partial<Record<L, number>>): L | 'fundo' {
    const f: Partial<PpuFrame> = { cgram: cg, oam: [] };
    if (layers.bg1 !== undefined) f.bg1 = layer(t4, { '0,0': 1 | (1 << 10) | (layers.bg1 << 13) });
    if (layers.bg2 !== undefined) f.bg2 = layer(t4, { '0,0': 1 | (2 << 10) | (layers.bg2 << 13) });
    if (layers.bg3 !== undefined) f.bg3 = layer(t2, { '0,0': 1 | (layers.bg3 << 13) });
    if (layers.obj !== undefined) f.oam = [{ x: 0, y: 0, size: 16, pal: 0, prio: layers.obj as 0 | 1 | 2 | 3, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } }];
    const p = at(draw(f), 2, 2);
    return (Object.keys(color) as L[]).find(k => color[k].join() === p.join()) ?? 'fundo';
  }
  it('BG2 prio 1 fica acima de BG1 prio 0; BG1 ganha com prioridades iguais', () => {
    expect(top({ bg1: 0, bg2: 1 })).toBe('bg2');
    expect(top({ bg1: 1, bg2: 1 })).toBe('bg1');
    expect(top({ bg1: 0, bg2: 0 })).toBe('bg1');
  });
  it('OBJ prio 2 entre BG prio 1 e BG prio 0', () => {
    expect(top({ bg1: 0, obj: 2 })).toBe('obj');
    expect(top({ bg1: 1, obj: 2 })).toBe('bg1');
    expect(top({ bg2: 1, obj: 2 })).toBe('bg2');
  });
  it('OBJ prio 1 fica abaixo de BG2 prio 0 e acima de BG3 prio 0; OBJ prio 0 abaixo de tudo', () => {
    expect(top({ bg2: 0, obj: 1 })).toBe('bg2');
    expect(top({ bg3: 0, obj: 1 })).toBe('obj');
    expect(top({ bg3: 0, obj: 0 })).toBe('bg3');
  });
  it('BG3 prio 1 fica acima de tudo, até de OBJ prio 3', () => {
    expect(top({ bg3: 1, obj: 3, bg1: 1 })).toBe('bg3');
    expect(top({ obj: 3, bg1: 1 })).toBe('obj');
  });
  it('máscara `main` da faixa esconde camadas', () => {
    const f = { cgram: cg, bg1: layer(t4, { '0,0': 1 | (1 << 10) }), bg2: layer(t4, { '0,0': 1 | (2 << 10) }) };
    expect(at(draw({ ...f, bands: [band({ main: 2 })] }), 2, 2)).toEqual(color.bg2);
  });
});

describe('PPU: sprites', () => {
  const cg = palette({ 129: C(31, 0, 0), 145: C(0, 31, 0), 17: C(0, 0, 31), 163: C(31, 31, 31), 133: C(9, 9, 9) });
  const solid = (v: number, size = 16) => new Uint8Array(size * size).fill(v);
  const obj = (o: Partial<ObjEntry>): ObjEntry => ({ x: 0, y: 0, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { px: solid(1) }, ...o });
  it('entre sprites, o índice menor fica na frente mesmo com prioridade menor (e leva a prioridade dele)', () => {
    const bg1 = layer(mk(4, 2, { 1: 1 }), { '0,0': 1 | (1 << 10) });      // BG1 prio 0, cor 17
    const oam = [obj({ prio: 0 }), obj({ prio: 3, pal: 1 })];               // 0: cor 129 prio 0; 1: cor 145 prio 3
    expect(at(draw({ cgram: cg, oam }), 2, 2)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam, bg1 }), 2, 2)).toEqual(rgbOf(cg[17]));  // o BG1 prio 0 cobre o sprite 0; o 1 some
    expect(at(draw({ cgram: cg, oam: [obj({ prio: 3 }), obj({ prio: 0, pal: 1 })], bg1 }), 2, 2)).toEqual(rgbOf(cg[129]));
  });
  it('32×32 por tile: linhas de 16 tiles; o x dá a volta dentro da linha', () => {
    const tiles = mk(4, 512, { 0x21: 3, 0x00: 5 });
    const img = draw({ cgram: cg, objTiles: tiles, oam: [obj({ x: 40, y: 50, size: 32, pal: 2, src: { tile: 0x10 } }), obj({ x: 0, y: 100, src: { tile: 0x0f } })] });
    expect(at(img, 48, 58)).toEqual(rgbOf(cg[163]));   // tile 0x10 + 1 + 16 = 0x21, cor 128 + 2·16 + 3
    expect(at(img, 55, 65)).toEqual(rgbOf(cg[163]));
    expect(at(img, 47, 58)).toEqual(BLACK);
    expect(at(img, 8, 100)).toEqual(rgbOf(cg[133]));   // tile 0x0F + 1 → 0x00 (não 0x10)
    const flipped = draw({ cgram: cg, objTiles: tiles, oam: [obj({ x: 40, y: 50, size: 32, pal: 2, hflip: true, src: { tile: 0x10 } })] });
    expect(at(flipped, 56, 58)).toEqual(rgbOf(cg[163]));
    expect(at(flipped, 48, 58)).toEqual(BLACK);
  });
  it('src.px com flips; corta nas bordas da tela', () => {
    const p = new Uint8Array(256); p[0] = 1;
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, src: { px: p } })] }), 100, 100)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, hflip: true, src: { px: p } })] }), 115, 100)).toEqual(rgbOf(cg[129]));
    expect(at(draw({ cgram: cg, oam: [obj({ x: 100, y: 100, vflip: true, src: { px: p } })] }), 100, 115)).toEqual(rgbOf(cg[129]));
    const edge = draw({ cgram: cg, oam: [obj({ x: -8, y: 0 }), obj({ x: 250, y: 30 })] });
    expect(at(edge, 7, 0)).toEqual(rgbOf(cg[129]));
    expect(at(edge, 8, 0)).toEqual(BLACK);
    expect(at(edge, 255, 30)).toEqual(rgbOf(cg[129]));
  });
});

describe('PPU: color math por faixa', () => {
  const cg = palette({ 17: C(20, 10, 4), 33: C(10, 31, 0), 193: C(2, 2, 2), 177: C(2, 2, 2) });
  const t = mk(4, 2, { 1: 1 });
  // (0,0): BG1 sobre BG2; (8,0): só BG1; (16,0): só BG2
  const f = (math: 'half' | 'add', extra: Partial<ScanBand> = {}, oam: ObjEntry[] = []): ImageData => draw({
    cgram: cg, oam,
    bg1: layer(t, { '0,0': 1 | (1 << 10), '1,0': 1 | (1 << 10) }),
    bg2: layer(t, { '0,0': 1 | (2 << 10), '2,0': 1 | (2 << 10) }),
    bands: [band({ main: 1 | 2 | 16, sub: 2, math, ...extra })],
  });
  it("'half' = média em 5 bits; sem BG2 embaixo, não muda", () => {
    const img = f('half');
    expect(at(img, 0, 0)).toEqual(rgbOf(C(15, 20, 2)));
    expect(at(img, 8, 0)).toEqual(rgbOf(C(20, 10, 4)));
    expect(at(img, 16, 0)).toEqual(rgbOf(C(10, 31, 0)));
  });
  it("'add' = soma saturada", () => {
    expect(at(f('add'), 0, 0)).toEqual(rgbOf(C(30, 31, 4)));
  });
  it('só as camadas de mathLayers (padrão BG1); OBJ só com paleta 4–7', () => {
    const spr = (pal: number): ObjEntry => ({ x: 0, y: 0, size: 16, pal, prio: 3, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } });
    expect(at(f('add', {}, [spr(4)]), 0, 0)).toEqual(rgbOf(C(2, 2, 2)));
    expect(at(f('add', { mathLayers: 16 }, [spr(4)]), 0, 0)).toEqual(rgbOf(C(12, 31, 2)));
    expect(at(f('add', { mathLayers: 16 }, [spr(3)]), 0, 0)).toEqual(rgbOf(C(2, 2, 2)));
  });
});

describe('PPU: modo 7 mínimo', () => {
  const chr = new Uint8Array(0x4000); chr.fill(7, 64, 128);           // tile 1 = cor 7
  const map = new Uint8Array(0x4000); map[0] = 1; map[127] = 1;
  const cg = palette({ 7: C(31, 0, 31), 129: C(0, 31, 0) });
  const m7 = { chr, map, a: 256, b: 0, c: 0, d: 256, cx: 0, cy: 0, hofs: 0, vofs: 0, outside: 'transparent' as const };
  it('identidade: pixel (x, y) do plano', () => {
    const img = draw({ cgram: cg, mode7: m7 });
    expect(at(img, 0, 0)).toEqual(rgbOf(cg[7]));
    expect(at(img, 7, 7)).toEqual(rgbOf(cg[7]));
    expect(at(img, 8, 0)).toEqual(BLACK);
  });
  it('escala 2× (a = d = 128)', () => {
    const img = draw({ cgram: cg, mode7: { ...m7, a: 128, d: 128 } });
    expect(at(img, 15, 15)).toEqual(rgbOf(cg[7]));
    expect(at(img, 16, 0)).toEqual(BLACK);
  });
  it("fora do plano: 'transparent' não desenha, 'wrap' repete", () => {
    expect(at(draw({ cgram: cg, mode7: { ...m7, hofs: -8 } }), 0, 0)).toEqual(BLACK);
    expect(at(draw({ cgram: cg, mode7: { ...m7, hofs: -8, outside: 'wrap' } }), 0, 0)).toEqual(rgbOf(cg[7]));
  });
  it('OBJ prio 0 atrás do plano, prio 1 na frente', () => {
    const o = (prio: 0 | 1): ObjEntry => ({ x: 0, y: 0, size: 16, pal: 0, prio, hflip: false, vflip: false, src: { px: new Uint8Array(256).fill(1) } });
    expect(at(draw({ cgram: cg, mode7: m7, oam: [o(0)] }), 0, 0)).toEqual(rgbOf(cg[7]));
    expect(at(draw({ cgram: cg, mode7: m7, oam: [o(1)] }), 0, 0)).toEqual(rgbOf(cg[129]));
  });
});

describe('PPU: desempenho', () => {
  it('quadro sintético com 3 BGs, faixas e 64 sprites: mediana < 4 ms', () => {
    let s = 1; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s; };
    const t4 = mk(4, 1024, {}); for (let i = 0; i < t4.px.length; i++) t4.px[i] = rnd() & 15;
    const t2 = mk(2, 512, {}); for (let i = 0; i < t2.px.length; i++) t2.px[i] = rnd() & 3;
    const map = () => Uint16Array.from({ length: 1024 }, () => rnd() & 0xffff);
    const cgram = Uint16Array.from({ length: 256 }, () => rnd() & 0x7fff);
    const oam: ObjEntry[] = Array.from({ length: 64 }, (_, i) => ({ x: (i * 37) % 256, y: (i * 53) % 224, size: i % 2 ? 32 : 16,
      pal: i & 7, prio: (i & 3) as 0 | 1 | 2 | 3, hflip: !!(i & 4), vflip: !!(i & 8), src: { tile: (i * 4) & 0x1ff } }));
    const f: PpuFrame = { cgram, oam, objTiles: mk(4, 512, {}),
      bg1: { map: map(), mapW: 32, tiles: t4, tile16: true, hofs: 8, vofs: -25 },
      bg2: { map: map(), mapW: 32, tiles: t4, tile16: true, hofs: 8, vofs: -25 },
      bg3: { map: map(), mapW: 32, tiles: t2, tile16: false, hofs: 0, vofs: 0 },
      bands: [band({ y0: 0, y1: 24, bg1: [8, -33] }), band({ y0: 24, y1: 224, bg1Tile16: true, sub: 2, math: 'half' })] };
    const img = createImage(), t: number[] = [];
    for (let i = 0; i < 40; i++) { const t0 = performance.now(); renderPpu(f, img); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b);
    expect(t[20]).toBeLessThan(4);
  });
});
