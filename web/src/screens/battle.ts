import type { App, Screen } from '../app/app';
import type { GameConfig } from '../game/config';
import { createSession, type Session } from '../game/session';
import { tickGame } from '../app/tick';
import { createView } from '../render/view';
import { drawSession } from '../render/draw-screens';
import { stageScreen } from './stage';

/** Hospeda uma partida. Quando ela termina (vitória confirmada ou saída pela pausa) volta para a seleção de fase. */
export function battleScreen(app: App, cfg: GameConfig, initialPads: number[]): Screen & { readonly session: Session } {
  const session = createSession(cfg, cfg.seed ?? app.seed(), initialPads);
  // Nenhum slot humano tem de fato um dispositivo (tudo CPU/desligado, ou humano sem controle atribuído):
  // sem isso, uma formação toda-CPU não teria como pausar, sair ou confirmar a vitória.
  session.anyControl = !cfg.humans.some((h, i) => h && app.settings.devices[i] !== 'none');
  const view = createView();
  return {
    id: 'battle',
    session,
    update(inp) {
      tickGame(session, view, inp.pads, inp.pressedAny);
      if (session.finished) app.go(stageScreen(app));
    },
    draw(ctx, bank, frame) { drawSession(ctx, session, view, bank, frame); },
    frozen: () => session.paused,
  };
}
