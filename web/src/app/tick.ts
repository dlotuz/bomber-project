import type { GameEvent } from '../core';
import { updateSession, type Session } from '../game/session';
import { updateView, type ViewState } from '../render/view';

/**
 * Avança a sessão um tick e só atualiza a visão (envelhecer explosões etc.) quando o
 * core de fato rodou um `step` neste tick — evita que a visão "adiante" sozinha
 * enquanto o jogo está pausado.
 */
export function tickGame(s: Session, view: ViewState, pads: number[]): GameEvent[] {
  const events = updateSession(s, pads);
  if (s.stepped) updateView(view, s.round, events);
  return events;
}
