/**
 * Motor em tempo real (roda dentro do AudioWorklet): intercala as operações do host com o APU,
 * gera o "NMI" do jogo a cada 17.067 ciclos (60 Hz) e entrega quadros a 32 kHz.
 * Regras:
 *  - operações longas (boot, bank, music, stop, fade) vão para uma fila e rodam uma de cada vez,
 *    consumindo ciclos do APU como o 65816 consumiria (a música $14 leva ≈ 1,13 s para começar);
 *  - o NMI só roda com o host livre; um NMI que cai durante uma operação fica pendente (1 no máximo);
 *  - SFX: fila de até 64 aqui dentro; cada NMI entrega no máximo 1 (e só se não houver outro pendente);
 *  - voz: `host.voice()` na hora; ignorada se já houver voz (contada em stats.ignoredVoices);
 *  - antes do fim do boot, SFX e voz são descartados;
 *  - banco/música/STOP/fade não começam durante o stream de uma voz: o NMI termina o stream antes (I1);
 *  - erro do host (handshake sem resposta, endereço fora da imagem): liga o APU de novo (power), refaz o
 *    boot e repete o último banco/música pedidos; só desiste (mudo) depois de MAX_RECOVERIES seguidas.
 */
import { FRAME_CYCLES, SpcHost, type ApuBus, type HostOp } from '../host/host';
import type { AudioImage } from '../host/image';
import type { SampleRing } from './ring';
import type { AudioCmd } from './commands';

export const SAMPLE_CYCLES = 32;
export const SFX_FIFO = 64;
export const MAX_RECOVERIES = 3;

/** O APU real (`Apu`) sabe religar; o motor usa isso para se recuperar de um erro do host. */
export type EngineBus = ApuBus & { power?(): void };

export interface EngineStats { frames: number; nmis: number; droppedSfx: number; ignoredVoices: number; errors: number; lastError: string }

export class AudioEngine {
  host: SpcHost;
  readonly stats: EngineStats = { frames: 0, nmis: 0, droppedSfx: 0, ignoredVoices: 0, errors: 0, lastError: '' };
  private readonly bus: EngineBus;
  private readonly ring: SampleRing;
  private readonly img: AudioImage;
  private readonly ops: AudioCmd[] = [];
  private readonly sfxFifo: number[] = [];
  private cur: HostOp | null = null;
  private toFrame = FRAME_CYCLES;
  private nmiPending = false;
  private booted = false;
  private bootQueued = false;
  private curIsOp = false;
  private lastBank: number | null = null;          // último banco/música pedidos (repetidos na recuperação)
  private lastMusic: number | null = null;
  private failures = 0;                             // erros seguidos, sem uma fila concluída entre eles
  broken = false;

  constructor(img: AudioImage, bus: EngineBus, ring: SampleRing) {
    this.bus = bus; this.ring = ring; this.img = img;
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
      this.fail(e);
    }
    const got = this.ring.shift(outL, outR, off, n);
    if (got < n) { outL.fill(0, off + got, off + n); outR.fill(0, off + got, off + n); }
    this.stats.frames += n;
  }

  private fail(e: unknown): void {
    this.stats.errors++; this.stats.lastError = String(e);
    if (++this.failures > MAX_RECOVERIES) { this.broken = true; return; }
    this.bus.power?.();
    this.host = new SpcHost(this.img, this.bus);
    this.cur = null; this.curIsOp = false; this.nmiPending = false;
    this.booted = false; this.bootQueued = false;
    this.sfxFifo.length = 0;
    const replay: AudioCmd[] = [];
    if (this.lastBank !== null && this.lastBank !== 0x2f) replay.push({ t: 'bank', id: this.lastBank as 0x2f | 0x30 });
    if (this.lastMusic !== null) replay.push({ t: 'music', id: this.lastMusic });
    this.ops.unshift(...replay);
    this.post({ t: 'boot' });                       // o boot já sobe o banco $2F
  }

  private nextOp(): HostOp | null {
    this.curIsOp = false;
    if (this.nmiPending && this.booted) {
      this.nmiPending = false; this.stats.nmis++;
      if (this.host.e2 === 0 && this.sfxFifo.length) this.host.sfx(this.sfxFifo.shift()!);
      return this.host.nmi();
    }
    if (this.host.streaming) return null;           // I1: banco/música/STOP/fade só depois do stream da voz
    const c = this.ops.shift();
    if (!c) return null;
    if (c.t !== 'boot' && !this.booted && !this.bootQueued) return this.nextOp();   // sem boot, nada a fazer
    this.curIsOp = true;
    switch (c.t) {
      case 'boot': this.lastBank = 0x2f; this.lastMusic = null; return this.withBootDone(this.host.boot());
      case 'bank': this.lastBank = c.id; this.lastMusic = null; return this.host.bank(c.id);
      case 'music': this.lastMusic = c.id; return this.host.music(c.id);
      case 'stop': this.lastMusic = null; return this.host.stop();
      case 'fade': this.lastMusic = null; return this.host.fade();
      default: this.curIsOp = false; return null;
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
        if (r.done) {
          if (this.curIsOp && !this.ops.length) this.failures = 0;   // fila concluída: a recuperação deu certo
          this.cur = null; continue;
        }
        used = r.value;
      } else used = left;
      this.bus.run(used);
      left -= used;
      this.toFrame -= used;
      if (this.toFrame <= 0) { this.toFrame += FRAME_CYCLES; this.nmiPending = true; break; }
    }
  }
}
