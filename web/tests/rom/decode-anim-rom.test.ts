import { ROM, fixture, sha1Hex } from './helpers';
import { RomView } from '../../src/rom/view';
import { decodeAnim, animKey } from '../../src/rom/decode/anim';
import { decodeBombScript } from '../../src/rom/decode/bombscript';

interface Fx {
  anims: Record<string, { frames: number; sha1: string }>;
  firstLevel: Record<string, { addr: number; perChar: number[] }>;
  bombScripts: { type: number; addr: number; loop: boolean; frames: [number, number][] }[];
}

describe.skipIf(!ROM)('animações da ROM (gfx-anims.json)', () => {
  const fx = fixture<Fx>('gfx-anims.json');
  const view = new RomView(ROM ?? new Uint8Array(0));
  it('as 141 animações decodificadas batem', () => {
    const keys = Object.keys(fx.anims);
    expect(keys).toHaveLength(141);
    for (const k of keys) {
      const a = decodeAnim(view, parseInt(k, 16));
      expect({ k, frames: a.length, sha1: sha1Hex(animKey(a)) }).toEqual({ k, ...fx.anims[k] });
    }
  });
  it('literais: andar → e morte [ANI §3]', () => {
    const q = (addr: number) => decodeAnim(view, addr).map(f => `g${f.pieces[0].tile}:${f.dur}`).join(' ');
    expect(q(0xd81693)).toBe('g4:12 g3:8 g5:12 g3:8');
    expect(q(0xd81999)).toBe('g24:5 g25:5 g26:6 g27:6');
    expect(decodeAnim(view, 0xd81693)[0].pieces[0]).toEqual({ dx: -16, dy: -24, tile: 4, hflip: false, vflip: false, big: true, palAdd: 0 });
  });
  it('$C1:7D5F = (g&3)·$80 + (g>>2)·$800 para g 0..127', () => {
    for (let g = 0; g < 128; g++) expect(view.u16(0xc17d5f + 4 * g) | (view.u16(0xc17d5f + 4 * g + 2) << 16)).toBe((g & 3) * 0x80 + (g >> 2) * 0x800);
  });
  it('tabelas de 1º nível por personagem', () => {
    for (const t of Object.values(fx.firstLevel))
      expect(Array.from({ length: 8 }, (_, c) => view.p24(t.addr + 3 * c))).toEqual(t.perChar);
  });
  it('scripts da bomba $C1:56A8 (normal 20/12/16/16, remota 16×4)', () => {
    for (const b of fx.bombScripts) {
      const s = decodeBombScript(view, view.p24(0xc156a8 + 3 * b.type));
      expect({ loop: s.loop, frames: s.frames.map(f => [f.word, f.dur]) }).toEqual({ loop: b.loop, frames: b.frames });
    }
    expect(fx.bombScripts[0].frames.slice(0, 4)).toEqual([[0x0b00, 20], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16]]);
    expect(fx.bombScripts[1].frames).toEqual([[0x0b08, 16], [0x0b0a, 16], [0x0b0c, 16], [0x0b0e, 16]]);
  });
});
