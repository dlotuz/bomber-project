/**
 * GameEvent → SFX/voz (§3.15 [AUD §3]). Registrado no `setGameEventAudio` do plano 10: `handle(sink, ev)`
 * roda a cada passo da partida com eventos. Os atrasos (acerto) contam ticks de jogo por `tick()`,
 * que o RomAudioSink chama 1× por tick (opção `onTick`), e saem no mesmo sink que recebeu o evento.
 * Eventos `{type: 'stage' | 'mount', id}` (planos 8 e 9) tocam pelas tabelas deles (`STAGE_SFX`,
 * `MOUNT_SFX`, injetadas no construtor; `null` = sem som). Um campo numérico `sfx`/`voice` no evento
 * também toca esses IDs.
 */
import type { AudioSink } from './sink';
import type { GameEvent } from '../core/types';

export const SKULL_FIRST = 0x21, SKULL_LAST = 0x2b;
export const HIT_VOICE_DELAY = 2;          // voz $06 2 ticks depois do acerto
export const HIT_SFX_DELAY = 13;           // SFX $10 ≈ 11 ticks depois da voz
export const MAX_PENDING = 64;

export interface EventSoundTables {
  stage: Readonly<Record<string, number>>;            // STAGE_SFX (plano 8, core/stages/events.ts)
  mount: Readonly<Record<string, number | null>>;     // MOUNT_SFX (plano 9, core/mounts/events.ts)
}

type Loose = { type: string; id?: unknown; item?: unknown; sfx?: unknown; voice?: unknown };
interface Pending { at: number; sink: AudioSink; kind: 'sfx' | 'voice'; id: number }

export class BattleAudio {
  private readonly tables: EventSoundTables;
  private now = 0;
  private pending: Pending[] = [];

  constructor(tables: EventSoundTables = { stage: {}, mount: {} }) { this.tables = tables; }

  reset(): void { this.pending = []; }

  handle(s: AudioSink, events: readonly GameEvent[]): void {
    for (const raw of events) {
      const e = raw as unknown as Loose;
      switch (e.type) {
        case 'bomb_placed': s.sfx(0x0c); break;
        case 'explosion': s.sfx(0x07); break;
        case 'item_picked': {
          const it = typeof e.item === 'number' ? e.item : 0;
          s.sfx(it >= SKULL_FIRST && it <= SKULL_LAST ? 0x0a : 0x08);
          break;
        }
        case 'disease_passed': s.sfx(0x0a); s.voice(0x04); break;
        case 'footstep': s.sfx(0x0b); break;
        case 'bomb_kicked': s.sfx(0x0d); break;
        case 'punch': case 'p_punch': s.sfx(0x0d); s.voice(0x03); break;
        case 'throw': s.sfx(0x0e); s.voice(0x03); break;
        case 'bomb_bounce': s.sfx(0x0e); break;
        case 'bomb_landed': s.sfx(0x0f); break;
        case 'player_hit':
          this.later(s, HIT_VOICE_DELAY, 'voice', 0x06);
          this.later(s, HIT_SFX_DELAY, 'sfx', 0x10);
          break;
        case 'stunned': s.sfx(0x12); s.voice(0x02); break;
        case 'hurry': s.sfx(0x15); s.voice(0x10); break;
        case 'pressure_step': s.sfx(0x27); break;
        case 'victory_sfx': s.sfx(0x17); break;
        case 'time_up': s.stop(); break;
        default: {
          const id = typeof e.id === 'string' ? e.id : '';
          const known = e.type === 'stage' ? this.tables.stage[id] : e.type === 'mount' ? this.tables.mount[id] : undefined;
          const sfx = typeof e.sfx === 'number' ? e.sfx : known ?? undefined;
          const voice = typeof e.voice === 'number' ? e.voice : undefined;
          if (sfx !== undefined) s.sfx(sfx);
          if (voice !== undefined) s.voice(voice);
        }
      }
    }
  }

  /** 1× por tick de jogo: avança o relógio e solta os atrasados que venceram. */
  tick(): void {
    this.now++;
    if (!this.pending.length) return;
    const due = this.pending.filter(p => p.at <= this.now);
    if (!due.length) return;
    this.pending = this.pending.filter(p => p.at > this.now);
    for (const p of due) { if (p.kind === 'sfx') p.sink.sfx(p.id); else p.sink.voice(p.id); }
  }

  private later(sink: AudioSink, delay: number, kind: 'sfx' | 'voice', id: number): void {
    if (this.pending.length >= MAX_PENDING) this.pending.shift();
    this.pending.push({ at: this.now + delay, sink, kind, id });
  }
}
