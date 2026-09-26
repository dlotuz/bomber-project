// Animação e metasprite [ANI §2.1–2.2]. Porte de anims.parse_anim / parse_ms.
import type { Anim, Piece } from '../types';
import type { RomView } from '../view';

/** Metasprite: u8 N; N × {s16 dx, s16 dy, u16 attr} (bit15 V, bit14 H, bit12 32×32, bits 9–11 paleta, 0–8 gráfico). */
export function decodeMetasprite(rom: RomView, addr: number): Piece[] {
  const n = rom.u8(addr), out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const o = addr + 1 + 6 * i, attr = rom.u16(o + 4);
    out.push({ dx: rom.s16(o), dy: rom.s16(o + 2), tile: attr & 0x1ff, hflip: (attr & 0x4000) !== 0,
      vflip: (attr & 0x8000) !== 0, big: (attr & 0x1000) !== 0, palAdd: (attr >> 9) & 7 });
  }
  return out;
}

/** Animação: u8 N; N × {ptr24 metasprite, u8 dur, s8 dx, s8 dy}. */
export function decodeAnim(rom: RomView, addr: number): Anim {
  const n = rom.u8(addr), out: Anim = [];
  for (let i = 0; i < n; i++) {
    const o = addr + 1 + 6 * i;
    out.push({ dur: rom.u8(o + 3), mx: rom.s8(o + 4), my: rom.s8(o + 5), pieces: decodeMetasprite(rom, rom.p24(o)) });
  }
  return out;
}

/** Forma canônica (usada pelos goldens): `dur,mx,my:dx,dy,tile,h,v,big,pal;…|…`. */
export function animKey(a: Anim): string {
  return a.map(f => `${f.dur},${f.mx},${f.my}:` + f.pieces.map(p =>
    `${p.dx},${p.dy},${p.tile},${+p.hflip},${+p.vflip},${+p.big},${p.palAdd}`).join(';')).join('|');
}
