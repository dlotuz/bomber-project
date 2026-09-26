import type { App, Screen } from '../app/app';
import { beginRound, endRound, closeMatch, type MatchSession } from '../game/match-session';
import { BTN, step, aiInputs, phaseElapsed, eventType, isDraw, drawReason, crownsOf, type RoundState } from '../game/core-api';
import {
  introBrightness, hurryX, hurryVisible, timeUpY, BANNER, PAUSE, WIN_END, DRAW_TIME_END, DRAW_DEAD_END,
} from '../game/timeline';
import { FADE_OUT_1, FADE_IN_1, fadeSpec } from '../app/fade';
import { SFX, MUSIC, BANK } from '../app/audio';
import { drawRomBattle, romState } from '../app/rom-api';
import { timeUpLabel } from '../render/text/text';
import { createView, updateView } from '../render/view';
import { drawRound } from '../render/draw-game';
import { drawBattleOverlays } from '../render/draw-screens';
import { scoreboardScreen } from './scoreboard';
import { drawScreen } from './draw';
import { stageScreen } from './stage';

export interface Banners {
  hurry: { x: number; y: number } | null;
  timeUp: { y: number; text: string } | null;
}
export type BattleScreen = Screen & {
  readonly ms: MatchSession; readonly round: RoundState; readonly paused: boolean; readonly disconnected: number | null;
  banners(): Banners;
};
/** `vis` do `drawRomBattle`: o plano 7 (D1) usa `RomBattleVis = { crowns }`; enquanto o stub do plano 5 tipa `ViewState`,
 *  o objeto passa pelo tipo do parâmetro (com o plano 7 o cast não faz nada). */
type RomVis = Parameters<typeof drawRomBattle>[2];

/** Hospeda uma rodada (§6.8–§6.10): intro por brilho, faixas, pausa (START de qualquer controle, $04, sem escurecer),
 *  saída segurando SELECT+START ou Esc 60 f, pausa por desconexão e o fim de rodada com os tempos e sons medidos. */
export function battleScreen(app: App, ms: MatchSession): BattleScreen {
  const round = beginRound(ms);
  const view = createView();
  let paused = false, ended = false, quitHold = 0;
  let disconnected: number | null = null;
  let prevConn: boolean[] | null = null;
  let hurryT0 = -1, timeUpT0 = -1;
  const humanGp = (i: number) => ms.cfg.humans[i] && ms.cfg.rules.active[i] && ms.cfg.devices[i].startsWith('gp');

  function endOfRound(): void {
    const res = round.result!;
    const draw = isDraw(res);
    const spec = !draw ? WIN_END : drawReason(res) === 'time' ? DRAW_TIME_END : DRAW_DEAD_END;
    ended = true;
    app.transition(() => (draw ? drawScreen(app, ms) : scoreboardScreen(app, ms)), {
      out: FADE_OUT_1, black: spec.black, in: FADE_IN_1, cues: [
        { at: spec.audioFadeAt, run: a => a.audio.fade() },
        { at: spec.crownAt, run: () => endRound(ms) },
        { at: spec.bankAt, run: a => a.audio.bank(BANK.menus) },
        { at: spec.musicAt, run: a => a.audio.music(draw ? MUSIC.draw : MUSIC.score) },
      ],
    });
  }
  function quit(): void {
    ended = true;
    closeMatch(ms);
    app.transition(() => stageScreen(app), fadeSpec(FADE_OUT_1, FADE_IN_1, [
      { at: 0, run: a => a.audio.fade() },
      { at: 16, run: a => a.audio.bank(BANK.menus) },
      { at: 58, run: a => a.audio.ensureMenus(MUSIC.menus) },
    ]));
  }
  const banners = (): Banners => ({
    hurry: hurryT0 >= 0 && hurryVisible(round.tick - hurryT0) ? { x: hurryX(round.tick - hurryT0), y: BANNER.hurryTop } : null,
    timeUp: timeUpT0 >= 0 ? { y: timeUpY(round.tick - timeUpT0), text: timeUpLabel() } : null,
  });

  return {
    id: 'battle', ms,
    get round() { return round; }, get paused() { return paused; }, get disconnected() { return disconnected; },
    banners,
    brightness: () => (round.phase === 'intro' ? introBrightness(phaseElapsed(round)) : 15),
    frozen: () => paused,
    update(inp) {
      if (ended) return;
      // Só a borda conectado → desconectado de um humano com gamepad pausa (R19); quem já começa desligado, não.
      if (prevConn) for (let i = 0; i < 5; i++) {
        if (humanGp(i) && prevConn[i] && !inp.connected[i]) {
          if (!paused) { paused = true; app.audio.sfx(SFX.pause); }
          disconnected = Number(ms.cfg.devices[i].slice(2)) + 1;
        }
      }
      prevConn = [...inp.connected];
      const selHeld = (inp.any & BTN.SELECT) !== 0;
      const startEdge = (inp.pressedAny & BTN.START) !== 0 && !selHeld;
      if (paused) {
        const combo = (inp.any & (BTN.SELECT | BTN.START)) === (BTN.SELECT | BTN.START) || inp.esc;
        quitHold = combo ? quitHold + 1 : 0;
        if (quitHold >= PAUSE.quitHold) { quit(); return; }
        if (startEdge) { paused = false; disconnected = null; quitHold = 0; app.audio.sfx(SFX.pause); }
        return;
      }
      if (startEdge) { paused = true; app.audio.sfx(SFX.pause); return; }
      const cpu = ms.cfg.humans.map((h, i) => !h && ms.cfg.rules.active[i]);
      const ai = aiInputs(round, ms.ai, cpu, ms.cfg.rules.cpuLevel);
      const pads = [0, 1, 2, 3, 4].map(i => (ms.cfg.humans[i] ? inp.pads[i] & ~(BTN.START | BTN.SELECT) : ai[i]));
      const ev = step(round, pads);
      updateView(view, round, ev);
      app.audio.playEvents(ev);
      for (const e of ev) {
        if (eventType(e) === 'hurry') hurryT0 = round.tick;
        if (eventType(e) === 'time_up') timeUpT0 = round.tick;
      }
      if (round.phase === 'over') endOfRound();
    },
    draw(ctx, bank, frame) {
      const a = romState.assets;
      const crowns = crownsOf(ms.match);
      if (!(a && drawRomBattle(ctx, round, { crowns } as unknown as RomVis, a, frame))) {
        drawRound(ctx, round, view, bank, ms.cfg.chars, frame, [...crowns]);
      }
      drawBattleOverlays(ctx, bank, { paused, disconnected, ...banners() });
    },
  };
}
