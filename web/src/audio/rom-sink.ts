/**
 * AudioSink real (§8.1): fila circular de 64 SFX no main thread, 1 SFX por tick de jogo
 * ($C3:4A7F/$C3:4AAA [AUD §1.5]); o resto vai direto ao worklet. Implementa também o
 * `VolumeControl` opcional do plano 10 (R25).
 */
import type { AudioSink } from './sink';
import type { AudioCmd } from './engine/commands';

export interface AudioTransport { send(cmd: AudioCmd): void; resume?(): void }
export interface RomSinkOptions { /** chamado no início de cada tick(), antes de tirar o SFX da fila (atrasos do BattleAudio) */ onTick?: () => void }
export const SFX_QUEUE = 64;

export class RomAudioSink implements AudioSink {
  private readonly t: AudioTransport;
  private readonly onTick: (() => void) | undefined;
  private readonly queue: number[] = [];
  /** Flag $CA do jogo: com ele, tick() descarta tudo menos o SFX $13. Não é ligado no Battle (🟡, A16). */
  dropAllButSfx13 = false;
  dropped = 0;
  constructor(t: AudioTransport, opts: RomSinkOptions = {}) { this.t = t; this.onTick = opts.onTick; }
  bank(id: 0x2f | 0x30): void { this.t.send({ t: 'bank', id }); }
  music(id: number): void { this.t.send({ t: 'music', id }); }
  sfx(id: number): void {
    if (this.queue.length >= SFX_QUEUE) { this.dropped++; return; }
    this.queue.push(id);
  }
  voice(id: number): void { this.t.send({ t: 'voice', id }); }
  stop(): void { this.t.send({ t: 'stop' }); }
  fade(): void { this.t.send({ t: 'fade' }); }
  tick(): void {
    this.onTick?.();
    while (this.queue.length) {
      const id = this.queue.shift()!;
      if (this.dropAllButSfx13 && id !== 0x13) continue;
      this.t.send({ t: 'sfx', id });
      return;
    }
  }
  /** VolumeControl (plano 10): música e efeitos separados, aplicados por voz do DSP no worklet (M5). */
  setVolume(music: number, sfx: number): void {
    const c = (x: number) => Math.max(0, Math.min(1, x));
    this.t.send({ t: 'volume', music: c(music), sfx: c(sfx) });
  }
  get pending(): number { return this.queue.length; }
}
