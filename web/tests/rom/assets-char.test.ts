import { ROM, fixture, sha1Hex, u16le } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadCharacter, hudHeadBuffer, CHAR_SHEETS, VICTORY_SHEETS } from '../../src/rom/assets-char';

interface Fx {
  chars: { char: number; sheet: number; victorySheet: number; framesSha1: string; victorySha1: string;
    palettes: { slot: number; addr: number; attr: number; sha1: string }[] }[];
  hudHeads: { char: number; slot: number; entry: number; sha1: string }[];
}
const cat = (xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };

describe.skipIf(!ROM)('personagens (gfx-anims.json)', () => {
  const fx = fixture<Fx>('gfx-anims.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('folhas (C1: personagem 5 em $CD:1800), quadros, paletas e VICTORY', () => {
    expect(fx.chars.map(c => c.sheet)).toEqual([0xd20000, 0xcb0000, 0xcb8000, 0xcc0000, 0xcc8000, 0xcd1800]);
    for (const e of fx.chars) {
      expect(view.p24(CHAR_SHEETS + 3 * e.char)).toBe(e.sheet);
      expect(view.p24(VICTORY_SHEETS + 3 * e.char)).toBe(e.victorySheet);
      const ch = loadCharacter(view, e.char, () => hudHeadBuffer(view));
      expect(sha1Hex(cat(Array.from({ length: 64 }, (_, g) => ch.frame(g))))).toBe(e.framesSha1);
      expect(sha1Hex(cat(Array.from({ length: 4 }, (_, g) => ch.victoryFrame(g))))).toBe(e.victorySha1);
      expect(ch.palettes.map(p => sha1Hex(u16le(p)))).toEqual(e.palettes.map(p => p.sha1));
      expect(e.palettes.map(p => p.attr)).toEqual([0, 2, 8, 10, 12]);
    }
  });
  it('rostos do HUD: entrada (6+c)·5+slot', () => {
    const buf = hudHeadBuffer(view);
    for (const h of fx.hudHeads) {
      const t = loadCharacter(view, h.char, () => buf).hudHead(h.slot);
      expect(t.count).toBe(6);
      expect(sha1Hex(t.px)).toBe(h.sha1);
    }
  });
  it('personagem fora de 0..5 é erro', () => {
    expect(() => loadCharacter(view, 6, () => new Uint8Array(0))).toThrow(RangeError);
  });
  it('victoryFrame e hudHead: cache (item 4) e RangeError fora do intervalo válido', () => {
    const ch = loadCharacter(view, 0, () => hudHeadBuffer(view));
    expect(ch.victoryFrame(0)).toBe(ch.victoryFrame(0));
    expect(() => ch.victoryFrame(-1)).toThrow(RangeError);
    expect(() => ch.victoryFrame(4)).toThrow(RangeError);
    expect(ch.hudHead(0)).toBe(ch.hudHead(0));
    expect(() => ch.hudHead(-1)).toThrow(RangeError);
    expect(() => ch.hudHead(5)).toThrow(RangeError);
  });
});
