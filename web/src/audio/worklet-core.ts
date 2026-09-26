/**
 * Lógica do processador de áudio, sem nada do escopo do AudioWorklet (testável no Node).
 * Recebe a imagem da ROM, cria o APU pela fábrica e renderiza a 32 kHz, reamostrando se o
 * contexto rodar em outra taxa. Comandos que chegam antes da imagem ficam guardados.
 */
import { AudioEngine } from './engine/engine';
import { SampleRing } from './engine/ring';
import { Resampler } from './engine/resample';
import { AudioImage } from './host/image';
import type { ApuBus } from './host/host';
import type { AudioCmd, WorkletIn, WorkletOut } from './engine/commands';

export const APU_RATE = 32000;
export type BusFactory = (ring: SampleRing) => ApuBus;

export class WorkletCore {
  engine: AudioEngine | null = null;
  private readonly rate: number;
  private readonly makeBus: BusFactory;
  private readonly post: (m: WorkletOut) => void;
  private readonly resampler: Resampler | null;
  private readonly early: AudioCmd[] = [];
  private sinceStats = 0;

  constructor(rate: number, makeBus: BusFactory, post: (m: WorkletOut) => void) {
    this.rate = rate; this.makeBus = makeBus; this.post = post;
    this.resampler = rate === APU_RATE ? null : new Resampler(APU_RATE, rate);
  }

  onMessage(m: WorkletIn): void {
    if (m.t === 'image') {
      const ring = new SampleRing(8192);
      this.engine = new AudioEngine(new AudioImage({ c0: m.c0, data: m.data }), this.makeBus(ring), ring);
      for (const c of this.early.splice(0)) this.engine.post(c);
      this.post({ t: 'ready' });
      return;
    }
    if (this.engine) this.engine.post(m); else this.early.push(m);
  }

  process(outL: Float32Array, outR: Float32Array, n: number): void {
    const e = this.engine;
    if (!e) { outL.fill(0, 0, n); outR.fill(0, 0, n); return; }
    if (this.resampler) this.resampler.process(outL, outR, n, (l, r, m) => e.render(l, r, m));
    else e.render(outL, outR, n);
    this.sinceStats += n;
    if (this.sinceStats >= this.rate) { this.sinceStats = 0; this.post({ t: 'stats', ...e.stats }); }
  }
}
