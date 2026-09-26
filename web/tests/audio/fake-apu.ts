import type { SampleRing } from '../../src/audio/engine/ring';
import { FakeDriver } from './fake-driver';

/** APU falso para o motor: o protocolo vem do FakeDriver; cada 32 ciclos geram 1 quadro (1000, −1000). */
export class FakeApu {
  readonly drv = new FakeDriver();
  private acc = 0;
  private readonly ring: SampleRing;
  constructor(ring: SampleRing) { this.ring = ring; }
  readPort(p: number): number { return this.drv.readPort(p); }
  writePort(p: number, v: number): void { this.drv.writePort(p, v); }
  run(c: number): void {
    this.drv.run(c);
    this.acc += c;
    while (this.acc >= 32) { this.acc -= 32; this.ring.push(1000, -1000); }
  }
}
