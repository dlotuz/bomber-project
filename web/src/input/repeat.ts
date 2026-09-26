import { BTN } from '../game/core-api';

export const DIRS: number = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT;

/** Repetição ao segurar [MNT §B.0]: pulso no 1º frame, depois em `first` e a cada `every`. Fora de `mask`, só a borda. */
export class Repeater {
  private held = new Map<number, number>();
  constructor(readonly first = 20, readonly every = 5, readonly mask: number = DIRS) {}

  step(held: number): number {
    let out = 0;
    for (let bit = 1; bit <= 0x800; bit <<= 1) {
      if (!(held & bit)) { this.held.delete(bit); continue; }
      const f = this.held.get(bit) ?? 0;
      this.held.set(bit, f + 1);
      const rep = (this.mask & bit) !== 0;
      if (f === 0 || (rep && f >= this.first && (f - this.first) % this.every === 0)) out |= bit;
    }
    return out;
  }

  reset(): void { this.held.clear(); }
}
