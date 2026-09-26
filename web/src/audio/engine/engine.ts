/**
 * Motor em tempo real (roda dentro do AudioWorklet): intercala as operações do host com o APU,
 * gera o "NMI" do jogo a cada 17.067 ciclos (60 Hz) e entrega quadros a 32 kHz.
 * Regras:
 *  - operações longas (boot, bank, music, stop, fade) vão para uma fila e rodam uma de cada vez,
 *    consumindo ciclos do APU como o 65816 consumiria (a música $14 leva ≈ 1,13 s para começar);
 *  - o NMI só roda com o host livre; um NMI que cai durante uma operação fica pendente (1 no máximo);
 *  - SFX: fila de até 64 aqui dentro; cada NMI entrega no máximo 1 (e só se não houver outro pendente);
 *  - voz: `host.voice()` na hora; ignorada se já houver voz (contada em stats.ignoredVoices);
 *  - antes do fim do boot, SFX e voz são descartados.
 */
import { FRAME_CYCLES, SpcHost, type ApuBus, type HostOp } from '../host/host';
import type { AudioImage } from '../host/image';
import type { SampleRing } from './ring';
import type { AudioCmd } from './commands';

export const SAMPLE_CYCLES = 32;
export const SFX_FIFO = 64;

export interface EngineStats { frames: number; nmis: number; droppedSfx: number; ignoredVoices: number; errors: number; lastError: string }

export class AudioEngine {
  readonly host: SpcHost;
  readonly stats: EngineStats = { frames: 0, nmis: 0, droppedSfx: 0, ignoredVoices: 0, errors: 0, lastError: '' };
  private readonly bus: ApuBus;
  private readonly ring: SampleRing;
  private readonly ops: AudioCmd[] = [];
  private readonly sfxFifo: number[] = [];
  private cur: HostOp | null = null;
  private toFrame = FRAME_CYCLES;
  private nmiPending = false;
  private booted = false;
  private bootQueued = false;
  broken = false;

  constructor(img: AudioImage, bus: ApuBus, ring: SampleRing) {
    this.bus = bus; this.ring = ring;
    this.host = new SpcHost(img, bus);
  }

  post(cmd: AudioCmd): void {
    switch (cmd.t) {
      case 'sfx':
        if (!this.booted) return;
        if (this.sfxFifo.length >= SFX_FIFO) { this.stats.droppedSfx++; return; }
        this.sfxFifo.push(cmd.id);
        return;
      case 'voice':
        if (!this.booted || !this.host.voice(cmd.id)) this.stats.ignoredVoices++;
        return;
      case 'boot':
        if (this.bootQueued) return;
        this.bootQueued = true;
        this.ops.unshift(cmd);
        return;
      default:
        this.ops.push(cmd);
    }
  }

  /** Escreve `n` quadros a 32 kHz em outL/outR[off..]. */
  render(outL: Float32Array, outR: Float32Array, n: number, off = 0): void {
    if (this.broken) { outL.fill(0, off, off + n); outR.fill(0, off, off + n); return; }
    try {
      while (this.ring.size < n) this.advance((n - this.ring.size) * SAMPLE_CYCLES);
    } catch (e) {
      this.broken = true; this.stats.errors++; this.stats.lastError = String(e);
    }
    const got = this.ring.shift(outL, outR, off, n);
    if (got < n) { outL.fill(0, off + got, off + n); outR.fill(0, off + got, off + n); }
    this.stats.frames += n;
  }

  private nextOp(): HostOp | null {
    if (this.nmiPending && this.booted) {
      this.nmiPending = false; this.stats.nmis++;
      if (this.host.e2 === 0 && this.sfxFifo.length) this.host.sfx(this.sfxFifo.shift()!);
      return this.host.nmi();
    }
    const c = this.ops.shift();
    if (!c) return null;
    if (c.t !== 'boot' && !this.booted && !this.bootQueued) return this.nextOp();   // sem boot, nada a fazer
    switch (c.t) {
      case 'boot': return this.withBootDone(this.host.boot());
      case 'bank': return this.host.bank(c.id);
      case 'music': return this.host.music(c.id);
      case 'stop': return this.host.stop();
      case 'fade': return this.host.fade();
      default: return null;
    }
  }
  private *withBootDone(op: HostOp): HostOp { yield* op; this.booted = true; }

  /** Avança o APU por ≈ `cycles` ciclos, rodando o host quando há trabalho. */
  private advance(cycles: number): void {
    let left = Math.min(cycles, this.toFrame);
    while (left > 0) {
      if (!this.cur) this.cur = this.nextOp();
      let used: number;
      if (this.cur) {
        const r = this.cur.next();
        if (r.done) { this.cur = null; continue; }
        used = r.value;
      } else used = left;
      this.bus.run(used);
      left -= used;
      this.toFrame -= used;
      if (this.toFrame <= 0) { this.toFrame += FRAME_CYCLES; this.nmiPending = true; break; }
    }
  }
}
