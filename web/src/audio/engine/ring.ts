/** Fila circular de quadros estéreo int16 (saída do DSP a 32 kHz). */
export interface SampleSink { push(l: number, r: number): void }

export class SampleRing implements SampleSink {
  private readonly buf: Int16Array;
  private readonly cap: number;
  private head = 0;                 // próximo quadro a ler
  private count = 0;
  dropped = 0;                      // quadros descartados por falta de espaço
  constructor(capacityFrames: number) { this.cap = capacityFrames; this.buf = new Int16Array(capacityFrames * 2); }
  get size(): number { return this.count; }
  push(l: number, r: number): void {
    if (this.count === this.cap) { this.dropped++; return; }
    const i = ((this.head + this.count) % this.cap) * 2;
    this.buf[i] = l; this.buf[i + 1] = r;
    this.count++;
  }
  /** Tira até `n` quadros para outL/outR[off..] como float (−1..1). Devolve quantos tirou. */
  shift(outL: Float32Array, outR: Float32Array, off: number, n: number): number {
    const m = Math.min(n, this.count);
    for (let k = 0; k < m; k++) {
      const i = this.head * 2;
      outL[off + k] = this.buf[i] / 32768; outR[off + k] = this.buf[i + 1] / 32768;
      this.head = (this.head + 1) % this.cap;
    }
    this.count -= m;
    return m;
  }
  clear(): void { this.head = 0; this.count = 0; }
}
