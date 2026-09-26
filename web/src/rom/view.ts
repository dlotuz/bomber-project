// Leitura da ROM por endereço SNES HiROM (spec §1.3, §2.3).

/** Offset no arquivo de um endereço SNES `$BB:AAAA` (HiROM). Aceita $C0–$FF, espelhos $40–$7D e $00–$3F/$80–$BF:8000+. */
export function hiromOffset(a: number): number {
  const b = (a >>> 16) & 0xff, o = a & 0xffff;
  if (b >= 0xc0) return ((b - 0xc0) << 16) | o;
  if (b >= 0x40 && b < 0x7e) return ((b - 0x40) << 16) | o;
  if (o >= 0x8000 && (b < 0x40 || (b >= 0x80 && b < 0xc0))) return ((b & 0x3f) << 16) | o;
  throw new RangeError(`endereço fora da ROM: $${hex(a)}`);
}

export function hex(a: number): string {
  return `${((a >>> 16) & 0xff).toString(16).toUpperCase().padStart(2, '0')}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export class RomView {
  readonly data: Uint8Array;
  constructor(data: Uint8Array) { this.data = data; }
  u8(a: number): number { return this.data[hiromOffset(a)]; }
  u16(a: number): number { const o = hiromOffset(a); return this.data[o] | (this.data[o + 1] << 8); }
  u24(a: number): number { const o = hiromOffset(a); return this.data[o] | (this.data[o + 1] << 8) | (this.data[o + 2] << 16); }
  /** Ponteiro de 24 bits que precisa apontar para a ROM (senão RangeError). */
  p24(a: number): number { const v = this.u24(a); hiromOffset(v); return v; }
  s8(a: number): number { return (this.u8(a) << 24) >> 24; }
  s16(a: number): number { return (this.u16(a) << 16) >> 16; }
  /** Cópia de `n` bytes a partir de `a` (lineares no arquivo). */
  bytes(a: number, n: number): Uint8Array { const o = hiromOffset(a); return this.data.slice(o, o + n); }
}
