import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ROM_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';

export interface Rom {
  sha1: string;
  u8(a: number): number; s8(a: number): number; u16(a: number): number; s16(a: number): number;
  u24(a: number): number; bytes(a: number, n: number): number[];
}

/** Endereço SNES HiROM ($C0–$FF, espelhos $40–$7D) → offset no arquivo. */
const off = (a: number): number => (((a >> 16) & 0x3f) << 16) | (a & 0xffff);

export function romFromBytes(buf: Uint8Array): Rom {
  const b = buf.length % 0x8000 === 512 ? buf.subarray(512) : buf;
  if (b.length !== 4194304) throw new Error(`ROM com tamanho inesperado: ${b.length}`);
  const sha1 = createHash('sha1').update(b).digest('hex');
  const u8 = (a: number): number => b[off(a)];
  const u16 = (a: number): number => u8(a) | (u8(a + 1) << 8);
  return {
    sha1, u8, u16,
    s8: a => ((u8(a) << 24) >> 24),
    s16: a => ((u16(a) << 16) >> 16),
    u24: a => u16(a) | (u8(a + 2) << 16),
    bytes: (a, n) => Array.from({ length: n }, (_, i) => u8(a + i)),
  };
}

export function loadRom(path: string): Rom {
  const rom = romFromBytes(new Uint8Array(readFileSync(path)));
  if (rom.sha1 !== ROM_SHA1) throw new Error(`ROM não suportada (SHA-1 ${rom.sha1})`);
  return rom;
}

export const hex = (a: number): string => `$${(a >> 16).toString(16).toUpperCase()}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
