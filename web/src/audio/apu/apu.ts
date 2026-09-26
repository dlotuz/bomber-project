/** O APU completo: 64 KB de RAM compartilhada, SPC700 (nosso) e S-DSP (porte LGPL). */
import { Smp } from './smp';
import { SpcDsp } from './dsp/spc-dsp';
import type { ApuBus } from '../host/host';
import type { SampleSink } from '../engine/ring';

export class Apu implements ApuBus {
  readonly ram = new Uint8Array(0x10000);
  readonly dsp: SpcDsp;
  readonly smp: Smp;
  constructor(out: SampleSink) {
    this.dsp = new SpcDsp(this.ram, out);
    this.smp = new Smp(this.ram, this.dsp);
    this.power();
  }
  /** Igual ao power_all do spctrace: SMP (zera a RAM) e depois DSP. */
  power(): void { this.smp.power(); this.dsp.reset(); }
  get cycles(): number { return this.smp.cycles; }
  readPort(p: number): number { return this.smp.readPort(p); }
  writePort(p: number, v: number): void { this.smp.writePort(p, v); }
  run(cycles: number): void { this.smp.run(cycles); }
}
