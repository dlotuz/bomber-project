import { RomView, hiromOffset, hex } from '../../src/rom/view';

describe('RomView e endereços HiROM (spec §1.3)', () => {
  it('bancos $C0–$FF, espelhos $40–$7D e $00–$3F/$80–$BF:8000+', () => {
    expect(hiromOffset(0xc00000)).toBe(0);
    expect(hiromOffset(0xd81693)).toBe(0x181693);
    expect(hiromOffset(0xffffff)).toBe(0x3fffff);
    expect(hiromOffset(0x581693)).toBe(0x181693);
    expect(hiromOffset(0x008000)).toBe(0x008000);
    expect(hiromOffset(0x9ffffc)).toBe(0x1ffffc);
  });
  it('WRAM e registradores não são ROM', () => {
    for (const a of [0x7e0000, 0x7f8000, 0x002100, 0x807fff]) expect(() => hiromOffset(a)).toThrow(RangeError);
  });
  it('u8/u16/u24/s8/s16 little-endian; p24 exige ponteiro para a ROM', () => {
    const b = new Uint8Array(0x400000);
    b.set([0x34, 0x12, 0xc4, 0xff, 0x80, 0x00, 0x80, 0x7f], 0x100);
    const r = new RomView(b);
    expect([r.u8(0xc00100), r.u16(0xc00100), r.u24(0xc00100)]).toEqual([0x34, 0x1234, 0xc41234]);
    expect([r.s8(0xc00103), r.s16(0xc00104)]).toEqual([-1, 128]);
    expect(r.p24(0xc00100)).toBe(0xc41234);
    expect(() => r.p24(0xc00105)).toThrow(RangeError);          // $7F:8000 = WRAM
    expect(r.u24(0xc00105)).toBe(0x7f8000);
    expect([...r.bytes(0xc00100, 3)]).toEqual([0x34, 0x12, 0xc4]);
  });
  it('bytes() devolve cópia', () => {
    const b = new Uint8Array(0x400000), r = new RomView(b);
    r.bytes(0xc00000, 4)[0] = 9;
    expect(b[0]).toBe(0);
  });
  it('hex formata $BB:AAAA', () => {
    expect(hex(0xc36233)).toBe('C3:6233');
  });
});
