import type { SampleRing } from '../../src/audio/engine/ring';
import { FakeDriver } from './fake-driver';

/** APU falso para o motor: o protocolo vem do FakeDriver; cada 32 ciclos geram 1 quadro (1000, −1000). */
export class FakeApu {
  drv = new FakeDriver();
  /** surdo: as portas lidas não respondem (o host estoura o tempo); `power()` religa e cura */
  deaf = false;
  powers = 0;
  private acc = 0;
  private readonly ring: SampleRing;
  constructor(ring: SampleRing) { this.ring = ring; }
  readPort(p: number): number { return this.deaf ? 0xee : this.drv.readPort(p); }
  power(): void { this.drv = new FakeDriver(); this.deaf = false; this.powers++; }
  writePort(p: number, v: number): void { this.drv.writePort(p, v); }
  run(c: number): void {
    this.drv.run(c);
    this.acc += c;
    while (this.acc >= 32) { this.acc -= 32; this.ring.push(1000, -1000); }
  }
}
