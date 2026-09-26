import { ROM, fixture, sha1Hex } from './helpers';
import { decodeZte } from '../../src/rom/decode/zte';
import { decodeM7Rle } from '../../src/rom/decode/m7rle';

interface Formats {
  zte: { addr: number; used: number; len: number; sha1: string }[];
  m7: { pix: number; map: number; usedPix: number; usedMap: number; sha1: string };
}

describe.skipIf(!ROM)('goldens de ZTE e Modo 7 (gfx-formats.json)', () => {
  const fx = fixture<Formats>('gfx-formats.json');
  it('ZTE: os 91 blocos distintos batem (tamanho comprimido, tamanho e SHA-1)', () => {
    expect(fx.zte).toHaveLength(91);
    for (const b of fx.zte) {
      const r = decodeZte(ROM!, b.addr);
      expect({ addr: b.addr, used: r.used, len: r.data.length, sha1: sha1Hex(r.data) }).toEqual(b);
    }
  });
  it('Modo 7 do DRAW GAME: 32 KB, consumo 6548 / 499', () => {
    const r = decodeM7Rle(ROM!, fx.m7.pix, fx.m7.map);
    expect([r.usedPix, r.usedMap]).toEqual([6548, 499]);
    expect(sha1Hex(r.vram)).toBe(fx.m7.sha1);
  });
});
