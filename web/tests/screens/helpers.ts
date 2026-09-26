import type { AudioSink } from '../../src/app/rom-api';

export type AudioOp = 'bank' | 'music' | 'sfx' | 'voice' | 'stop' | 'fade';
export interface AudioCall { t: number; op: AudioOp; id?: number }

/** Sink que grava cada chamada com o `app.tick` do momento. */
export class RecordingSink implements AudioSink {
  calls: AudioCall[] = [];
  ticks = 0;
  now: () => number = () => 0;
  private rec(op: AudioOp, id?: number): void { this.calls.push(id === undefined ? { t: this.now(), op } : { t: this.now(), op, id }); }
  bank(id: number): void { this.rec('bank', id); }
  music(id: number): void { this.rec('music', id); }
  sfx(id: number): void { this.rec('sfx', id); }
  voice(id: number): void { this.rec('voice', id); }
  stop(): void { this.rec('stop'); }
  fade(): void { this.rec('fade'); }
  tick(): void { this.ticks++; }
  of(op: AudioOp): AudioCall[] { return this.calls.filter(c => c.op === op); }
  /** Chamadas a partir do tick `t0` (inclusive), com `t` relativo a ele. */
  since(t0: number): AudioCall[] { return this.calls.filter(c => c.t >= t0).map(c => ({ ...c, t: c.t - t0 })); }
  clear(): void { this.calls = []; }
}
