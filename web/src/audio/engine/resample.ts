/**
 * Reamostragem 32 kHz → taxa do AudioContext (Hermite cúbica, 4 pontos), só usada quando o navegador
 * não aceita `new AudioContext({ sampleRate: 32000 })`. Latência fixa de 2 amostras de entrada.
 */
export type Fill = (l: Float32Array, r: Float32Array, n: number) => void;

const BLOCK = 256;

export class Resampler {
  private readonly step: number;
  private pos = 0;
  private readonly hl = new Float32Array(4);
  private readonly hr = new Float32Array(4);
  private readonly bl = new Float32Array(BLOCK);
  private readonly br = new Float32Array(BLOCK);
  private bi = BLOCK;
  consumed = 0;                                  // amostras de entrada consumidas
  constructor(inRate: number, outRate: number) { this.step = inRate / outRate; }

  process(outL: Float32Array, outR: Float32Array, n: number, fill: Fill): void {
    const hl = this.hl, hr = this.hr;
    for (let i = 0; i < n; i++) {
      while (this.pos >= 1) {
        this.pos -= 1;
        if (this.bi === BLOCK) { fill(this.bl, this.br, BLOCK); this.bi = 0; }
        hl[0] = hl[1]; hl[1] = hl[2]; hl[2] = hl[3]; hl[3] = this.bl[this.bi];
        hr[0] = hr[1]; hr[1] = hr[2]; hr[2] = hr[3]; hr[3] = this.br[this.bi];
        this.bi++; this.consumed++;
      }
      outL[i] = hermite(this.pos, hl[0], hl[1], hl[2], hl[3]);
      outR[i] = hermite(this.pos, hr[0], hr[1], hr[2], hr[3]);
      this.pos += this.step;
    }
  }
}

function hermite(t: number, a: number, b: number, c: number, d: number): number {
  const m0 = (c - a) * 0.5, m1 = (d - b) * 0.5;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m0 + (t3 - t2) * m1 + (-2 * t3 + 3 * t2) * c;
}
