/** O APU completo: 64 KB de RAM compartilhada, SPC700 (nosso) e S-DSP (porte LGPL). */
import { Smp } from './smp';
import { SpcDsp } from './dsp/spc-dsp';
import type { ApuBus } from '../host/host';
import type { SampleSink } from '../engine/ring';

/** Driver da Hudson: `$00C7 + v` (v = 0..2) com o bit 7 = a voz v do DSP está com um SFX ou uma voz
 *  digitalizada (medido com a ROM: todo KON de SFX/voz sai com o bit ligado, e nenhum da música). As vozes
 *  3..7 são só da música. */
export const SFX_OWNER = 0x00c7, SFX_VOICES = 3;

export class Apu implements ApuBus {
  readonly ram = new Uint8Array(0x10000);
  readonly dsp: SpcDsp;
  readonly smp: Smp;
  private musicGain = 256;
  private sfxGain = 256;
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
  /** Volumes 0..1 da música e dos efeitos; valem a partir do próximo `updateMix()`. */
  setVolume(music: number, sfx: number): void {
    const q = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 256);
    this.musicGain = q(music); this.sfxGain = q(sfx);
    this.updateMix();
  }
  /** Reparte o ganho entre as vozes conforme o dono atual (música ou efeito); o motor chama a cada bloco. */
  updateMix(): void {
    const g = this.dsp.voiceGain;
    for (let v = 0; v < 8; v++) g[v] = v < SFX_VOICES && (this.ram[SFX_OWNER + v] & 0x80) ? this.sfxGain : this.musicGain;
  }
}
