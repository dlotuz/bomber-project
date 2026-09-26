// Script da bomba parada [ANI §5.1]: {u16 palavra, u8 dur} até FFFF (loop) ou FFFE (fim).
import type { RomView } from '../view';

export interface BombScript { frames: { word: number; dur: number }[]; loop: boolean }

export function decodeBombScript(rom: RomView, addr: number, max = 64): BombScript {
  const frames: { word: number; dur: number }[] = [];
  for (let a = addr; frames.length < max; a += 3) {
    const w = rom.u16(a);
    if (w === 0xffff) return { frames, loop: true };
    if (w === 0xfffe) return { frames, loop: false };
    frames.push({ word: w, dur: rom.u8(a + 2) });
  }
  throw new RangeError(`script de bomba sem fim em ${addr.toString(16)}`);
}
