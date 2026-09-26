import type { App, Screen } from '../app/app';
import type { MatchSession } from '../game/match-session';
import { BTN } from '../game/core-api';
import { DRAW_SCENE, NEXT_ROUND, drawColor, drawScale } from '../game/timeline';
import { BANK, MUSIC, VOICE } from '../app/audio';
import { FADE_OUT_1 } from '../app/fade';
import { romState } from '../app/rom-api';
import { drawEmpateFallback, drawEmpateRom } from '../render/screens-rom/draw';
import { battleScreen } from './battle';

/** Tela EMPATE (spec §6.11, §7.5, R5, R6, R21): Modo 7 crescendo (E, M, A da ROM; P, T próprios — T18) com as
 *  letras trocando de cor, os 5 personagens ativos sobre o disco e só A/B pulando para a próxima rodada. Não dá
 *  coroa nem mexe em `ms.match`: o `endRound` da T12 já rodou no cue do fim de rodada. */
export function drawScreen(app: App, ms: MatchSession): Screen & { readonly s: number; letters(): { scale: number; color: 0 | 1 | 2 } } {
  // `s` conta a partir do 1º frame do fade-in (spec §6.11): -1 antes do 1º update, 0 nele.
  let s = -1;
  const letters = (): { scale: number; color: 0 | 1 | 2 } => ({ scale: drawScale(s), color: drawColor(s) as 0 | 1 | 2 });
  const input = () => ({ chars: ms.cfg.chars, active: ms.cfg.rules.active });
  return {
    id: 'draw',
    get s() { return s; },
    letters,
    update(inp) {
      s++;
      if (s === DRAW_SCENE.voiceAt) app.audio.voice(VOICE.draw);
      if (s >= DRAW_SCENE.skipFrom && (inp.pressedAny & (BTN.A | BTN.B))) {
        app.transition(() => battleScreen(app, ms), {
          out: FADE_OUT_1, black: NEXT_ROUND.afterDraw, in: [],
          cues: [
            { at: NEXT_ROUND.bankAt, run: a => a.audio.bank(BANK.battle) },
            { at: NEXT_ROUND.musicAt, run: a => a.audio.music(MUSIC.battle) },
          ],
        });
      }
    },
    draw(ctx, bank) {
      const a = romState.assets;
      const g = s < DRAW_SCENE.growTo ? 54 : 52;
      if (a) drawEmpateRom(ctx, bank, a, input(), letters(), g);
      else drawEmpateFallback(ctx, bank, input(), letters());
    },
  };
}
