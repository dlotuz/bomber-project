/**
 * Liga o som original ao jogo. Importado 1 vez pelo main.ts (`import './audio/register';`), como
 * combinado com o plano 10 (R26 e T22 dele): registra a fábrica do sink real e o mapeamento dos eventos.
 */
import { registerAudioFactory, setGameEventAudio } from '../app/audio';
import { romState } from '../rom/state';
import { STAGE_SFX } from '../core/stages/events';
import { MOUNT_SFX } from '../core/mounts/events';
import type { GameEvent } from '../core/types';
import { AudioClient } from './client';
import { BattleAudio } from './events';
import { createAudioFactory } from './factory';

/** Voz do desmonte sem reserva (pendência do plano 9). `$C2:105E` → `LDA $48`/`BEQ $C2:10B0` (sem reserva) →
 *  `$C2:10B4 BIT #$0001` em `+$C2`: com o bit, só o limpa; sem ele, `LDA #$04`/`JSL $C3:4AF9` (voz $04). O
 *  lançamento do D liga o bit (`$C2:4785`), então não fala. Com reserva (`$C2:1089`) não há voz. Não modelado: o
 *  bit que sobra de um lançamento com reserva cala o próximo desmonte. O atordoamento (L15 do plano 9: a montaria
 *  some, sem o pulo) fica sem voz (não medido), e a reserva queimada (`$C2:6645`–`$C2:6687`) não chama som. */
export const DISMOUNT_VOICE = 0x04;
const hitDismount = (e: GameEvent): boolean => {
  const m = e as unknown as { type: string; id?: unknown; reserve?: unknown; cause?: unknown };
  return m.type === 'mount' && m.id === 'mount_lost' && m.reserve === false && m.cause === 'hit';
};
export function withDismountVoice(ev: readonly GameEvent[]): readonly GameEvent[] {
  return ev.some(hitDismount) ? ev.map(e => (hitDismount(e) ? Object.assign({}, e, { voice: DISMOUNT_VOICE }) : e)) : ev;
}

const battle = new BattleAudio({ stage: STAGE_SFX, mount: MOUNT_SFX });

const factory = createAudioFactory({
  currentRom: () => romState.assets?.rom ?? null,
  createClient: s => AudioClient.create(s, m => {
    if (import.meta.env.DEV && m.t === 'stats' && (m.errors || m.droppedSfx)) console.warn('áudio:', m);
  }),
  onTick: () => battle.tick(),
  onSink: () => battle.reset(),                    // M2: descarta os atrasos acumulados com o NoopSink
  onError: e => console.warn('Som original indisponível:', e),
});
registerAudioFactory(factory);
/** Repassa um gesto do usuário ao AudioContext atual (pode ter nascido suspenso). */
export const resumeAudio = (): void => factory.resume();
setGameEventAudio((sink, ev) => battle.handle(sink, withDismountVoice(ev)));
