import { digitTile, faceTileIds, headOverrides, headTiles, hudWords } from '../../src/render/rom/hud';
import { fakeCharacter } from './fakes';
import { ASSETS } from './rom-fixture';

const base = () => {
  const w = new Uint16Array(96).fill(0x260b);
  for (let r = 0; r < 3; r++) w[r * 32 + 5] = 0x263a + 0x10 * r;
  return w;
};
const crownWord = (n: number) => 0x2640 + n;
const NONE = [false, false, false, false, false];
const ZERO = [0, 0, 0, 0, 0];
const cols = (w: Uint16Array, r: number, cs: number[]) => cs.map(c => w[r * 32 + c]);

describe('HUD', () => {
  it('dígito: $2F + d, e $39 para o 0', () => {
    expect([0, 1, 5, 9].map(digitTile)).toEqual([0x39, 0x30, 0x34, 0x38]);
  });
  it('relógio 3:01 nas três linhas', () => {
    const w = hudWords(base(), 181, NONE, ZERO, crownWord);
    expect(cols(w, 0, [4, 5, 6, 7])).toEqual([0x2632, 0x263a, 0x2639, 0x2630]);
    expect(cols(w, 1, [4, 5, 6, 7])).toEqual([0x2642, 0x264a, 0x2649, 0x2640]);
    expect(cols(w, 2, [4, 5, 6, 7])).toEqual([0x2652, 0x265a, 0x2659, 0x2650]);
  });
  it('1:00, 0:59 e 0:00', () => {
    expect(cols(hudWords(base(), 60, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2630, 0x2639, 0x2639]);
    expect(cols(hudWords(base(), 59, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2639, 0x2634, 0x2638]);
    expect(cols(hudWords(base(), 0, NONE, ZERO, crownWord), 0, [4, 6, 7])).toEqual([0x2639, 0x2639, 0x2639]);
  });
  it('∞ = 30:01: dezena dos minutos na coluna 3 (D17)', () => {
    const w = hudWords(base(), 1801, NONE, ZERO, crownWord);
    expect(cols(w, 0, [3, 4, 6, 7])).toEqual([0x2632, 0x2639, 0x2639, 0x2630]);
    expect(hudWords(base(), 181, NONE, ZERO, crownWord)[3]).toBe(0x260b);
  });
  it('rostos e coroas só dos presentes; ausente fica com o fundo', () => {
    const w = hudWords(base(), 180, [true, false, true, true, true], [0, 4, 1, 5, 9], crownWord);
    expect(cols(w, 0, [10, 11, 14, 15, 18, 19])).toEqual([0x2601, 0x2602, 0x260b, 0x260b, 0x2605, 0x2606]);
    expect(cols(w, 1, [10, 11])).toEqual([0x2611, 0x2612]);
    expect(cols(w, 2, [26, 27])).toEqual([0x2629, 0x262a]);
    expect(cols(w, 1, [12, 16, 20, 24, 28])).toEqual([0x2640, 0x260b, 0x2641, 0x2645, 0x2649]);
  });
  it('não altera a base', () => {
    const b = base();
    hudWords(b, 181, [true, true, true, true, true], ZERO, crownWord);
    expect(b[4]).toBe(0x260b);
  });
  it('tiles dos rostos por slot e trocas 8×8', () => {
    expect(faceTileIds(0)).toEqual([0x201, 0x202, 0x211, 0x212, 0x221, 0x222]);
    expect(faceTileIds(4)).toEqual([0x209, 0x20a, 0x219, 0x21a, 0x229, 0x22a]);
    const h = headTiles(fakeCharacter(2), 0);
    expect(h.map(t => t[0])).toEqual([0x50, 0x51, 0x52, 0x53, 0x54, 0x55]);
    const o = headOverrides([h, null, null, null, h]);
    expect(o.map(x => x.tile)).toEqual([...faceTileIds(0), ...faceTileIds(4)]);
    expect(o[0].px).toBe(h[0]);
  });
});

describe.skipIf(!ASSETS)('HUD da ROM', () => {
  it('mapa-base: moldura, ícone, ":" e fundo $0B; cabeças com 6 tiles', () => {
    const hud = ASSETS!.arena(1).hudMap;
    expect(Array.from(hud.slice(0, 8))).toEqual([0x6600, 0x2600, 0x260c, 0x260d, 0x260b, 0x263a, 0x260b, 0x260b]);
    expect(hud[32 + 5]).toBe(0x264a);
    for (let c = 0; c < 6; c++) for (let slot = 0; slot < 5; slot++) expect(headTiles(ASSETS!.character(c), slot).every(t => t.length === 64)).toBe(true);
  });
});
