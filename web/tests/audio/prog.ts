/** Roda um programa sintético (modo `prog` do spctrace) e resume o log de MMIO. */
import type { Smp } from '../../src/audio/apu/smp';
import { mmioBytes, sha1 } from './node';

export interface ProgResult {
  mmioCount: number; mmioSha1: string; ramSha1: string;
  regs: { pc: number; a: number; x: number; y: number; sp: number; psw: number; cycles: number };
}

/** O SMP já deve estar ligado ao DSP certo; `power()` é chamado aqui. A cada passo k: portas 0/1/2 = k, 7k, k>>1; run(1000). */
export function runProg(s: Smp, img: Uint8Array, steps: number): ProgResult {
  s.power();
  s.ram.set(img);
  s.pc = 0x0200;
  const log: number[] = [];
  s.onBus = (k, addr, data, cycle) => {
    if (k !== 3 && (addr & 0xfff0) === 0x00f0) log.push(cycle, k === 1 ? 0x72 : 0x77, addr & 0xff, data);
  };
  for (let k = 0; k < steps; k++) {
    s.writePort(0, k & 0xff); s.writePort(1, (k * 7) & 0xff); s.writePort(2, (k >> 1) & 0xff);
    s.run(1000);
  }
  s.onBus = null;
  const mmio = mmioBytes(log);
  return {
    mmioCount: mmio.length / 8, mmioSha1: sha1(mmio), ramSha1: sha1(s.ram),
    regs: { pc: s.pc, a: s.a, x: s.x, y: s.y, sp: s.sp, psw: s.psw, cycles: s.cycles },
  };
}
