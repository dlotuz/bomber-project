import { NoopSink, type AudioSink } from './rom-api';
import type { GameEvent } from '../game/core-api';

export const SFX = { move: 0x01, confirm: 0x02, back: 0x03, pause: 0x04 } as const;
export const MUSIC = { title: 0x01, menus: 0x12, battleStart: 0x13, battle: 0x14, score: 0x15, victory: 0x16, draw: 0x18 } as const;
export const BANK = { battle: 0x2f, menus: 0x30 } as const;
export const VOICE = { battleStart: 0x07, victory: 0x0a, draw: 0x0e } as const;

/** Interface opcional: o sink real (plano 11) pode aceitar volume (0..1). */
export interface VolumeControl { setVolume(music: number, sfx: number): void }
const hasVolume = (s: AudioSink): s is AudioSink & VolumeControl =>
  typeof (s as Partial<VolumeControl>).setVolume === 'function';

type EventAudio = (sink: AudioSink, ev: readonly GameEvent[]) => void;
let eventAudio: EventAudio = () => {};
/** O plano 11 registra aqui o mapeamento GameEvent → SFX/voz (§3.15). */
export function setGameEventAudio(f: EventAudio): void { eventAudio = f; }

/** Envolve o sink: lembra banco e música (para repetir quando o sink real chega depois do gesto), volume e eventos. */
export class AudioDirector implements AudioSink {
  current: { bank: number | null; music: number | null } = { bank: null, music: null };
  private vol: [number, number] | null = null;

  constructor(private sink: AudioSink = new NoopSink()) {}

  setSink(s: AudioSink): void {
    this.sink = s;
    if (this.vol && hasVolume(s)) s.setVolume(this.vol[0], this.vol[1]);
    if (this.current.bank !== null) s.bank(this.current.bank as 0x2f | 0x30);
    if (this.current.music !== null) s.music(this.current.music);
  }
  bank(id: 0x2f | 0x30): void { this.current = { bank: id, music: null }; this.sink.bank(id); }
  music(id: number): void { this.current.music = id; this.sink.music(id); }
  sfx(id: number): void { this.sink.sfx(id); }
  voice(id: number): void { this.sink.voice(id); }
  stop(): void { this.current.music = null; this.sink.stop(); }
  fade(): void { this.current.music = null; this.sink.fade(); }
  tick(): void { this.sink.tick(); }
  setVolume(music: number, sfx: number): void {
    this.vol = [music, sfx];
    if (hasVolume(this.sink)) this.sink.setVolume(music, sfx);
  }
  playEvents(ev: readonly GameEvent[]): void { if (ev.length) eventAudio(this, ev); }
  /** Garante o banco das telas ($30) e a música pedida, sem reiniciar o que já toca. */
  ensureMenus(music: number): void {
    if (this.current.bank !== BANK.menus) this.bank(BANK.menus);
    if (this.current.music !== music) this.music(music);
  }
}
