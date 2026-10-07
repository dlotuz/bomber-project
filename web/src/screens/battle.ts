import type { App, Screen } from '../app/app';
import { beginRound, endRound, closeMatch, type MatchSession } from '../game/match-session';
import { BTN, CODE, step, aiInputs, phaseElapsed, eventType, isDraw, drawReason, crownsOf, type RoundState } from '../game/core-api';
import {
  introBrightness, hurryX, hurryVisible, timeUpY, BANNER, PAUSE, WIN_END, DRAW_TIME_END, DRAW_DEAD_END,
} from '../game/timeline';
import { FADE_OUT_1, FADE_IN_1, fadeSpec } from '../app/fade';
import { SFX, MUSIC, BANK } from '../app/audio';
import { drawRomBattle, romState, type RomAssets } from '../app/rom-api';
import { renderRomBattle } from '../render/rom/battle';
import { prepareFxPixels } from '../render/fx/draw';
import { timeUpLabel } from '../render/text/text';
import { createView, updateView } from '../render/view';
import { drawRound } from '../render/draw-game';
import { drawBattleOverlays, drawBombLevels } from '../render/draw-screens';
import { scoreboardScreen } from './scoreboard';
import { drawScreen } from './draw';
import { stageScreen } from './stage';
import type { SpriteBank } from '../render/sprite-bank';
import { sampleBase } from '../render/display';
import { cellX, cellY } from '../render/fx/coords';
import { createFx, type FxFrame } from '../render/fx/state';
import { DEBRIS_COLOR, fxUpdate } from '../render/fx/update';

export interface Banners {
  hurry: { x: number; y: number } | null;
  timeUp: { y: number; text: string } | null;
}
export type BattleScreen = Screen & {
  readonly ms: MatchSession; readonly round: RoundState; readonly paused: boolean; readonly disconnected: number | null;
  banners(): Banners;
};
/** Hospeda uma rodada (§6.8–§6.10): intro por brilho, faixas, pausa (START de qualquer controle, $04, sem escurecer),
 *  saída segurando SELECT+START ou Esc 60 f, pausa por desconexão e o fim de rodada com os tempos e sons medidos. */
export function battleScreen(app: App, ms: MatchSession): BattleScreen {
  const round = beginRound(ms);
  const view = createView();
  // Efeitos visuais (spec 2026-10-01): estado próprio, avançado a cada tick; o quadro "sem atores" alimenta a sombra.
  const fx = createFx();
  /** O App pediu os efeitos no último quadro (Opções e `?fx`): só então a sombra suave existe e a chapada do sprite
   *  da ROM sai (uma sombra por personagem); com eles desligados, ou as sombras em pausa pelo orçamento, fica a da ROM. */
  let fxShown = false;
  const hardShadows = new Set<number>();
  const SOFT_SHADOWS = { softShadows: true, hardShadows };
  let last: { bank: SpriteBank; frame: number } | null = null;
  const NO_ACTORS = { sprites: false, layers: [] };
  const BOMBS_ONLY = { sprites: false, layers: [], bombSprites: true };
  // Na ROM a bomba parada é tile de fundo: o quadro "sem atores" usa uma cópia da rodada sem bombas (objeto estável,
  // para a memória de congelamento por rodada do render da ROM continuar valendo).
  const bombless = { ...round };
  const withoutBombs = (): RoundState => {
    Object.assign(bombless, round);
    bombless.grid = round.grid.map(v => (v === CODE.BOMB ? CODE.FLOOR : v));
    bombless.bombs = [];
    return bombless;
  };
  /** Quadros de referência dos efeitos (sem atores / só bombas), desenhados pela PPU direto em memória. */
  const refs: (ImageData | null)[] = [null, null];
  const refPixels = (a: RomAssets, bombs: boolean, crowns: readonly number[], frame: number): Uint8ClampedArray | null => {
    const img = renderRomBattle(refs[+bombs] ??= new ImageData(256, 224), bombs ? round : withoutBombs(), { crowns }, a, frame,
      bombs ? BOMBS_ONLY : NO_ACTORS);
    return img && img.data;
  };
  /** Pixels do último quadro da ROM (cor dos destroços sem ler o canvas); null = arte própria. */
  let pixels: Uint8ClampedArray | null = null;
  const colorAt = (c: number): number => {
    const x = cellX(c), y = cellY(c);
    if (!pixels) return sampleBase(x, y, DEBRIS_COLOR);
    const i = (Math.round(y) * 256 + Math.round(x)) * 4;
    return pixels[i + 3] ? (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2] : DEBRIS_COLOR;
  };
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

  const fxFrame: FxFrame = {
    state: fx, round, hardShadows,
    drawNoActors(ctx, bombs = false) {
      if (!last) return;
      const a = romState.assets, crowns = crownsOf(ms.match);
      // só bombas: a rodada de verdade (na ROM a parada é BG2) sem sprites, mas com as bombas-objeto
      const rom = a && (bombs ? drawRomBattle(ctx, round, { crowns }, a, last.frame, BOMBS_ONLY) : drawRomBattle(ctx, withoutBombs(), { crowns }, a, last.frame, NO_ACTORS));
      if (!rom) drawRound(ctx, round, view, last.bank, ms.cfg.chars, last.frame, [...crowns], { actors: false, bombs });
      drawBombLevels(ctx, last.bank, round);
      drawBattleOverlays(ctx, last.bank, { paused, disconnected, ...banners() });
    },
  };

  return {
    id: 'battle', ms,
    get round() { return round; }, get paused() { return paused; }, get disconnected() { return disconnected; },
    banners,
    brightness: () => (round.phase === 'intro' ? introBrightness(phaseElapsed(round)) : 15),
    frozen: () => paused,
    fx: () => { fxShown = app.settings.options.fx; return fxShown ? fxFrame : null; },
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
      fxUpdate(fx, round, ev, colorAt);
      app.audio.playEvents(ev);
      for (const e of ev) {
        if (eventType(e) === 'hurry') hurryT0 = round.tick;
        if (eventType(e) === 'time_up') timeUpT0 = round.tick;
      }
      if (round.phase === 'over') endOfRound();
    },
    draw(ctx, bank, frame) {
      last = { bank, frame };
      const a = romState.assets;
      const crowns = crownsOf(ms.match);
      const soft = fxShown && fx.shadowsPause === 0;
      hardShadows.clear();
      fxFrame.prep = undefined;
      // Efeitos nos pixels do quadro, antes de irem para o canvas: os quadros de referência saem da PPU em memória.
      fxFrame.rom = !!a && drawRomBattle(ctx, round, { crowns }, a, frame, soft ? SOFT_SHADOWS : {}, img => {
        pixels = img.data;
        if (fxShown) fxFrame.prep = prepareFxPixels(fx, round, img.data, bombs => refPixels(a, bombs, crowns, frame));
      });
      if (!fxFrame.rom) pixels = null;
      if (!fxFrame.rom) drawRound(ctx, round, view, bank, ms.cfg.chars, frame, [...crowns]);
      drawBombLevels(ctx, bank, round);
      drawBattleOverlays(ctx, bank, { paused, disconnected, ...banners() });
    },
  };
}
