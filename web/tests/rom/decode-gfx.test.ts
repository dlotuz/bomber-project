import { decodeZte } from '../../src/rom/decode/zte';
import { composite, compositeFloor } from '../../src/rom/decode/composite';
import { arena9Post } from '../../src/rom/decode/arena9';
import { decodeM7Rle } from '../../src/rom/decode/m7rle';
import { readBgr555, c5to8, bgr555ToRgba } from '../../src/rom/decode/palette';
import { decodeTiles } from '../../src/rom/decode/tiles';

/** ROM sintética de 64 KB no banco $C0 com `bytes` a partir de $C0:1000. */
function romWith(bytes: number[]): Uint8Array { const r = new Uint8Array(0x10000); r.set(bytes, 0x1000); return r; }
const tile = (first: number) => Array.from({ length: 32 }, (_, i) => (i === 0 ? first : i));

describe('ZTE [GFX §2.1]', () => {
  it('Z = tile zerado, E = fim, outro byte = 32 bytes literais', () => {
    const r = decodeZte(romWith([0xaa, 0xbb, 0xaa, ...tile(7), 0xaa, 0xbb, 0x99]), 0xc01000);
    expect(r.used).toBe(2 + 1 + 32 + 1 + 1);
    expect(r.data).toHaveLength(96);
    expect([...r.data.subarray(0, 32)].every(v => v === 0)).toBe(true);
    expect([...r.data.subarray(32, 64)]).toEqual(tile(7));
    expect([...r.data.subarray(64)].every(v => v === 0)).toBe(true);
  });
  it('Z é testado antes de E (Z == E: só zeros até estourar o limite)', () => {
    expect(() => decodeZte(romWith([0x11, 0x11, 0x11]), 0xc01000, 64)).toThrow(RangeError);
  });
  it('bloco vazio', () => {
    expect(decodeZte(romWith([1, 2, 2]), 0xc01000)).toEqual({ data: new Uint8Array(0), used: 3 });
  });
});

describe('composição do piso [GFX §2.2]', () => {
  it('só os pixels de cor 0 do destino recebem o pixel da origem', () => {
    const buf = new Uint8Array(0x8000);
    buf.fill(0xff, 0x100, 0x120);                 // tile 8 (piso): cor 15 em tudo
    buf[0x6000] = 0xf0;                            // tile 768, linha 0: pixels 0–3 com cor 1 (plano 0)
    compositeFloor(buf);
    expect(buf[0x6000]).toBe(0xf0 | 0x0f);        // plano 0: 4 pixels próprios + 4 do piso
    expect(buf[0x6001]).toBe(0x0f);               // planos 1–3 só nos pixels que eram 0
    expect(buf[0x6010]).toBe(0x0f);
    expect(buf[0x6011]).toBe(0x0f);
    expect(buf[0x6002]).toBe(0xff);               // linha 1 inteira do piso
  });
  it('n usa o bloco 16×16 de origem: (n&1) + 16·((n>>4)&1)', () => {
    const buf = new Uint8Array(0x10000);
    for (const [k, v] of [[0, 1], [1, 2], [16, 3], [17, 4]]) buf[0x1000 + 32 * k] = v;
    composite(buf, 0x1000, 0x8000, 32);
    expect([0, 1, 16, 17, 2, 18].map(n => buf[0x8000 + 32 * n])).toEqual([1, 2, 3, 4, 1, 3]);
  });
});

describe('arena 9 [GFX §2.3]', () => {
  it('cópias antes das composições', () => {
    const buf = new Uint8Array(0x8000);
    buf[0x2000] = 0x11; buf[0x3800] = 0x22; buf[0x3fff] = 0x33;
    arena9Post(buf);
    expect(buf[0x2c00]).toBe(0x11);
    expect(buf[0x2400]).toBe(0x22);
    expect(buf[0x3000]).toBe(0x22);
    expect(buf[0x2bff]).toBe(0x33);
  });
});

describe('RLE do Modo 7 [GFX §2.4]', () => {
  it('pixels: <$80 literal, ≥$80 repete; mapa: $01 N v repete, senão literal', () => {
    const r = new Uint8Array(0x10000);
    r.set([0x05, 0x83, 0x03, 0x06], 0x1000);      // pixels: 5, 3,3,3, 6
    r.set([0x09, 0x01, 0x03, 0x42, 0x07], 0x2000); // mapa: 9, 42,42,42, 7
    const m = decodeM7Rle(r, 0xc01000, 0xc02000, 5);
    expect([...m.vram]).toEqual([0x09, 5, 0x42, 3, 0x42, 3, 0x42, 3, 0x07, 6]);
    expect([m.usedPix, m.usedMap]).toEqual([4, 5]);
  });
});

describe('paleta e tiles [GFX §2.5]', () => {
  it('BGR555 → 8 bits por canal (c<<3 | c>>2)', () => {
    expect(readBgr555(new Uint8Array([0x1f, 0x7c]), 0, 1)[0]).toBe(0x7c1f);
    expect([c5to8(0), c5to8(1), c5to8(31)]).toEqual([0, 8, 255]);
    expect(bgr555ToRgba(0x7c1f)).toEqual([255, 0, 255, 255]);
    expect(bgr555ToRgba(0x03e0)).toEqual([0, 255, 0, 255]);
  });
  it('4bpp planar: bit 7−x de t[2y], t[2y+1], t[16+2y], t[17+2y]', () => {
    const t = new Uint8Array(32);
    t[0] = 0x80; t[1] = 0x80; t[16] = 0x80; t[17] = 0x80;   // (0,0) = 15
    t[2] = 0x01;                                             // (7,1) = 1
    t[31] = 0x40;                                            // (1,7) = 8
    const d = decodeTiles(t, 4);
    expect([d.count, d.px[0], d.px[1 * 8 + 7], d.px[7 * 8 + 1], d.px[1]]).toEqual([1, 15, 1, 8, 0]);
  });
  it('2bpp planar: t[2y], t[2y+1]; 16 bytes por tile', () => {
    const t = new Uint8Array(32); t[0] = 0x80; t[1] = 0x40; t[16 + 15] = 0x01;
    const d = decodeTiles(t, 2);
    expect([d.count, d.px[0], d.px[1], d.px[64 + 7 * 8 + 7]]).toEqual([2, 1, 2, 2]);
  });
  it('offset e quantidade explícitos; bytes além do fim contam como 0', () => {
    const d = decodeTiles(new Uint8Array(40).fill(0xff), 4, 32, 2);
    expect([d.count, d.px[0], d.px[64]]).toEqual([2, 3, 0]);   // só os planos 0–1 existem (bytes 32–39)
  });
});
