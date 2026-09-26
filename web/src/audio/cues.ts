/**
 * Roteiros de som das transições, em frames de tela a partir do 1º evento [AUD §2], e os bancos
 * exigidos por música e voz [AUD §3]. O plano 10 pode tocá-los com `CuePlayer` ou chamar o seu
 * `AudioDirector` nos mesmos frames; o teste garante que cada voz/música toca com o banco certo.
 */
import type { AudioSink } from './sink';

export type Bank = 0x2f | 0x30;
export const MUSIC_BANK: Record<number, Bank> = { 0x01: 0x30, 0x12: 0x30, 0x13: 0x30, 0x14: 0x2f, 0x15: 0x30, 0x16: 0x30, 0x18: 0x30 };
export const VOICE_BANK: Record<number, Bank> = { 0x01: 0x30, 0x02: 0x2f, 0x03: 0x2f, 0x04: 0x2f, 0x06: 0x2f, 0x07: 0x30, 0x0a: 0x30, 0x0e: 0x30, 0x10: 0x2f };

export type Cue =
  | { at: number; kind: 'sfx' | 'music' | 'voice'; id: number }
  | { at: number; kind: 'bank'; id: Bank }
  | { at: number; kind: 'fade' | 'stop' };

export interface CueScript { startBank: Bank; cues: Cue[] }

export const CUES = {
  /** Fase escolhida → partida (§6.7): SFX $02, jingle $13, voz $07, FADE, banco $2F, música $14. */
  stageToBattle: { startBank: 0x30, cues: [
    { at: 0, kind: 'sfx', id: 0x02 }, { at: 48, kind: 'music', id: 0x13 }, { at: 208, kind: 'voice', id: 0x07 },
    { at: 310, kind: 'fade' }, { at: 511, kind: 'bank', id: 0x2f }, { at: 523, kind: 'music', id: 0x14 },
  ] },
  /** Rodada com vencedor (§6.10), a partir do SFX $17. */
  roundWin: { startBank: 0x2f, cues: [
    { at: 0, kind: 'sfx', id: 0x17 }, { at: 97, kind: 'fade' }, { at: 113, kind: 'bank', id: 0x30 }, { at: 154, kind: 'music', id: 0x15 },
  ] },
  /** Próxima rodada, sem repetir o $13 (os +12 f entre banco e música são 🟡, iguais aos 511→523). */
  nextRound: { startBank: 0x30, cues: [{ at: 0, kind: 'bank', id: 0x2f }, { at: 12, kind: 'music', id: 0x14 }] },
  /** Última coroa (§6.12): como roundWin + música $16 (+671) e voz $0A (+955). */
  matchVictory: { startBank: 0x2f, cues: [
    { at: 0, kind: 'sfx', id: 0x17 }, { at: 97, kind: 'fade' }, { at: 113, kind: 'bank', id: 0x30 }, { at: 154, kind: 'music', id: 0x15 },
    { at: 671, kind: 'music', id: 0x16 }, { at: 955, kind: 'voice', id: 0x0a },
  ] },
  /** TIME UP → EMPATE (§6.11): STOP em 0:00, FADE +161, banco $30 +218, música $18 +228, voz $0E +426. */
  timeUpDraw: { startBank: 0x2f, cues: [
    { at: 0, kind: 'stop' }, { at: 161, kind: 'fade' }, { at: 218, kind: 'bank', id: 0x30 },
    { at: 228, kind: 'music', id: 0x18 }, { at: 426, kind: 'voice', id: 0x0e },
  ] },
  /** Todos mortos → EMPATE: FADE, banco $30, música $18 (mesmos intervalos do TIME UP, 🟡). */
  allDeadDraw: { startBank: 0x2f, cues: [
    { at: 0, kind: 'fade' }, { at: 57, kind: 'bank', id: 0x30 }, { at: 67, kind: 'music', id: 0x18 }, { at: 265, kind: 'voice', id: 0x0e },
  ] },
} satisfies Record<string, CueScript>;

export class CuePlayer {
  private readonly sink: AudioSink;
  private readonly cues: Cue[];
  private f = 0;
  private i = 0;
  constructor(sink: AudioSink, script: CueScript) { this.sink = sink; this.cues = [...script.cues].sort((a, b) => a.at - b.at); }
  /** 1× por frame de tela. Devolve false quando o roteiro acabou. */
  tick(): boolean {
    while (this.i < this.cues.length && this.cues[this.i].at <= this.f) {
      const c = this.cues[this.i++];
      switch (c.kind) {
        case 'sfx': this.sink.sfx(c.id); break;
        case 'music': this.sink.music(c.id); break;
        case 'voice': this.sink.voice(c.id); break;
        case 'bank': this.sink.bank(c.id); break;
        case 'fade': this.sink.fade(); break;
        case 'stop': this.sink.stop(); break;
      }
    }
    this.f++;
    return this.i < this.cues.length;
  }
}
