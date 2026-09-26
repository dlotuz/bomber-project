import type { RomBattleBuilder } from '../../battle-layers';
// Conferido na Task 1, item 11: o plano 5 exporta `decodeZte(rom: Uint8Array, addr, limit?) → { data, used }`
// (bytes crus do arquivo, não o RomView); o RomView expõe os bytes em `data`.
import { decodeZte } from '../../../rom/decode/zte';

export interface RomPiece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
export interface RomAnimFrame { dur: number; mx: number; my: number; pieces: RomPiece[] }
/** O que as camadas de arena usam do RomAssets do plano 5 (§2.3), por tipagem estrutural. */
export interface StageRomAssets {
  /** `RomView` do plano 5; `data` = bytes do arquivo (só `decodeZteAt` usa; os fakes de teste podem omitir). */
  rom: { u8(a: number): number; u16(a: number): number; readonly data?: Uint8Array };
  anim(addr: number): RomAnimFrame[];
}
export const assetsOf = (a: object): StageRomAssets => a as StageRomAssets;

/** Quadro de uma animação em loop, `t` ticks depois do início. */
export function animFrameAt(anim: RomAnimFrame[], t: number): RomAnimFrame {
  const total = anim.reduce((n, f) => n + Math.max(1, f.dur), 0);
  let r = ((t % total) + total) % total;
  for (const f of anim) { const d = Math.max(1, f.dur); if (r < d) return f; r -= d; }
  return anim[0];
}

/** Paleta animada: quadro `k = ⌊tick/ticks⌋ mod frames`, 16 cores a partir de `base + 32k`, escritas em cgBase..cgBase+15. */
export function writePaletteFrame(b: RomBattleBuilder, a: StageRomAssets, base: number, frames: number, ticks: number, tick: number, cgBase: number): number {
  const k = Math.floor(tick / ticks) % frames;
  for (let i = 0; i < 16; i++) b.cgram(cgBase + i, a.rom.u16(base + 32 * k + 2 * i));
  return k;
}

/** Bloco ZTE decodificado a partir do endereço SNES (plano 5). */
export function decodeZteAt(a: StageRomAssets, addr: number): Uint8Array {
  const bytes = a.rom.data;
  if (!bytes) throw new Error('decodeZteAt: RomAssets sem os bytes da ROM (rom.data)');
  return decodeZte(bytes, addr).data;
}
