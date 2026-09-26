import type { App, Screen } from '../app/app';
import type { MatchSession } from '../game/match-session';
import { createSession, type Session } from '../game/session';
import { tickGame } from '../app/tick';
import { createView } from '../render/view';
import { drawSession } from '../render/draw-screens';
import { stageScreen } from './stage';

/** Hospeda uma partida. Quando ela termina (vitória confirmada ou saída pela pausa) volta para a seleção de fase.
 *  `ms` (o `MatchSession` do plano 10) só carrega a configuração e o RNG por agora; a `Session` (plano 6) continua
 *  hospedando o jogo de fato até a T12 trocar de verdade. */
export function battleScreen(app: App, ms: MatchSession): Screen & { readonly ms: MatchSession; readonly session: Session } {
  const cfg = ms.cfg;
  const session = createSession(cfg, ms.cfg.seed ?? 0x0012, [0, 0, 0, 0, 0]);
  // Nenhum slot humano tem de fato um dispositivo (tudo CPU/desligado, ou humano sem controle atribuído):
  // sem isso, uma formação toda-CPU não teria como pausar, sair ou confirmar a vitória.
  session.anyControl = !cfg.humans.some((h, i) => h && app.settings.devices[i] !== 'none');
  const view = createView();
  return {
    id: 'battle',
    ms,
    session,
    update(inp) {
      tickGame(session, view, inp.pads, inp.pressedAny);
      if (session.finished) app.go(stageScreen(app));
    },
    draw(ctx, bank, frame) { drawSession(ctx, session, view, bank, frame); },
    frozen: () => session.paused,
  };
}
