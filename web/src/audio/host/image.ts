/**
 * Fatias de áudio da ROM do usuário [AUD §1.1]: $C0:0190–$C0:07EA (tabelas do lado CPU) e
 * $D9:0000–$DE:9C94 (driver, sequências, samples, sets). Endereços SNES HiROM de 24 bits.
 */
export const C0_START = 0xc00190;
export const C0_END = 0xc007eb;          // exclusivo
export const DATA_START = 0xd90000;
export const DATA_END = 0xde9c95;        // exclusivo

export interface AudioSlices { c0: Uint8Array; data: Uint8Array }

/** `rom` = arquivo sem cabeçalho de copiadora (4 MB). Offset = endereço − $C00000 (bancos $C0–$FF). */
export function slicesFromRom(rom: Uint8Array): AudioSlices {
  return {
    c0: rom.slice(C0_START - 0xc00000, C0_END - 0xc00000),
    data: rom.slice(DATA_START - 0xc00000, DATA_END - 0xc00000),
  };
}

/** Mesmas fatias a partir do `RomView` do plano 5 (`bytes(endereçoSNES, n)`), sem depender do tipo dele. */
export function slicesFromView(v: { bytes(addr: number, n: number): Uint8Array }): AudioSlices {
  return { c0: v.bytes(C0_START, C0_END - C0_START).slice(), data: v.bytes(DATA_START, DATA_END - DATA_START).slice() };
}

export class AudioImage {
  readonly slices: AudioSlices;
  constructor(slices: AudioSlices) {
    this.slices = slices;
    if (slices.c0.length !== C0_END - C0_START) throw new RangeError('fatia $C0 com tamanho errado');
    if (slices.data.length !== DATA_END - DATA_START) throw new RangeError('fatia $D9–$DE com tamanho errado');
  }
  u8(addr: number): number {
    if (addr >= C0_START && addr < C0_END) return this.slices.c0[addr - C0_START];
    if (addr >= DATA_START && addr < DATA_END) return this.slices.data[addr - DATA_START];
    throw new RangeError(`endereço de áudio fora das fatias: $${addr.toString(16)}`);
  }
  u16(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8); }
  u24(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8) | (this.u8(addr + 2) << 16); }
}
