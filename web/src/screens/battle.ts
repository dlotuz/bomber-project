import type { App, Screen } from '../app/app';
import { beginRound, endRound, closeMatch, applyLiveSettings, type MatchSession } from '../game/match-session';
import { extrasFromSettings } from '../game/config';
import { BTN, CODE, step, endRoundDraw, aiInputs, phaseElapsed, eventType, isDraw, drawReason, crownsOf, type RoundState } from '../game/core-api';
import {
  introBrightness, hurryX, hurryVisible, timeUpY, BANNER, PAUSE, WIN_END, DRAW_TIME_END, DRAW_DEAD_END,
} from '../game/timeline';
import { FADE_OUT_1, FADE_IN_1, FADE_MENU, fadeSpec, shortBlack } from '../app/fade';
import { SFX, MUSIC, BANK } from '../app/audio';
import { drawRomBattle, romState, type RomAssets } from '../app/rom-api';
import { renderRomBattle } from '../render/rom/battle';
import { prepareFxPixels } from '../render/fx/draw';
import { timeUpLabel } from '../render/text/text';
import { createView, updateView } from '../render/view';
import { drawRound } from '../render/draw-game';
import { drawBattleOverlays, drawBombLevels, drawFuseClock, createFuseClock } from '../render/draw-screens';
import { scoreboardScreen } from './scoreboard';
import { drawScreen } from './draw';
import { stageScreen } from './stage';
import { charactersScreen } from './characters';
import { optionsScreen } from './options';
import { playersScreen } from './players';
import { rulesScreen } from './rules';
import type { SlotKind } from '../game/config';
import { Menu, type MenuRow } from './menu';
import { S } from '../render/text/strings';
import { racerScreen } from './racer';
import type { SpriteBank } from '../render/sprite-bank';
import { sampleBase } from '../render/display';
import { cellX, cellY } from '../render/fx/coords';
import { createFx, type FxFrame } from '../render/fx/state';
import { DEBRIS_COLOR, fxUpdate } from '../render/fx/update';

export interface Banners {
  hurry: { x: number; y: number } | null;
  timeUp: { y: number; text: string } | null;
}
export type PauseItem = 'resume' | 'players' | 'rules' | 'chars' | 'stage' | 'controls' | 'gameplay' | 'options' | 'draw' | 'quit';
export type BattleScreen = Screen & {
  readonly ms: MatchSession; readonly round: RoundState; readonly paused: boolean; readonly disconnected: number | null;
  /** Menu da pausa aberto: ids dos itens e a linha do cursor (null fora da pausa). */
  readonly pauseMenu: { items: readonly PauseItem[]; cursor: number } | null;
  banners(): Banners;
};
/** Hospeda uma rodada (§6.8–§6.10): intro por brilho, faixas, pausa (START de qualquer controle, $04, sem escurecer),
 *  saída segurando SELECT+START ou Esc 60 f, pausa por desconexão e o fim de rodada com os tempos e sons medidos.
 *  Extra: a pausa abre um menu com tudo o que se ajusta antes da partida, sem precisar sair dela: JOGADORES (Humano ↔
 *  CPU na hora; entrar/sair da partida, da próxima rodada), REGRAS (nível da CPU e coroas na hora; tempo, morte súbita e
 *  bomber vingador da próxima rodada), PERSONAGEM (na hora), MAPA (próxima rodada), CONTROLES, JOGABILIDADE e OPÇÕES
 *  (na hora), ENCERRAR RODADA e SAIR. As telas abertas dali voltam para esta mesma rodada pausada.
 *  Na sala online o START não chega aqui (net/online.ts), então não há pausa nem menu. */
export function battleScreen(app: App, ms: MatchSession): BattleScreen {
  const fuseClock = createFuseClock();
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
  let menu: Menu | null = null;
  let disconnected: number | null = null;
  let prevConn: boolean[] | null = null;
  let hurryT0 = -1, timeUpT0 = -1;
  const humanGp = (i: number) => ms.cfg.humans[i] && ms.cfg.rules.active[i] && ms.cfg.devices[i].startsWith('gp');

  function endOfRound(): void {
    const res = round.result!;
    const draw = isDraw(res);
    const spec = !draw ? WIN_END : drawReason(res) === 'time' ? DRAW_TIME_END : DRAW_DEAD_END;
    ended = true;
    // Partida decidida: nada de placar nem vitória — só fecha e volta para a escolha de fase (no online, dali a sala).
    // `ms.over` já vale aqui: a coroa entra no cue `crownAt`, antes de a tela nova ser criada.
    const next = (): Screen => {
      if (draw || !ms.over) return draw ? drawScreen(app, ms) : scoreboardScreen(app, ms);
      closeMatch(ms);
      return ms.cfg.rules.racer && ms.cfg.rules.mode === 'ffa' ? racerScreen(app, ms) : stageScreen(app);
    };
    app.transition(next, shortBlack({
      out: FADE_OUT_1, black: spec.black, in: FADE_IN_1, cues: [
        { at: spec.audioFadeAt, run: a => a.audio.fade() },
        { at: spec.crownAt, run: () => endRound(ms) },
        { at: spec.bankAt, run: a => a.audio.bank(BANK.menus) },
        { at: spec.musicAt, run: a => (!draw && ms.over ? a.audio.ensureMenus(MUSIC.menus) : a.audio.music(draw ? MUSIC.draw : MUSIC.score)) },
      ],
    }));
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
  // ---- menu da pausa ----
  const PAUSE_ITEMS: readonly PauseItem[] = ['resume', 'players', 'rules', 'chars', 'stage', 'controls', 'gameplay', 'options', 'draw', 'quit'];
  const pause = (): void => { paused = true; menu = pauseMenu(); app.audio.sfx(SFX.pause); };
  const resume = (): void => { paused = false; menu = null; disconnected = null; quitHold = 0; app.audio.sfx(SFX.pause); };
  /** Abre uma tela por cima da rodada; o `ret` dela devolve esta tela (mesma rodada, ainda pausada) com o banco e a
   *  música que tocavam, e aplica na partida o que mudou nos controles e na jogabilidade. */
  const openSub = (make: (ret: () => Screen) => Screen): void => {
    const saved = { ...app.audio.current };
    const ret = (): Screen => {
      app.audio.bank((saved.bank ?? BANK.battle) as 0x2f | 0x30);
      if (saved.music !== null) app.audio.music(saved.music);
      const st = app.settings;
      applyLiveSettings(ms, st.options.randomSpawns, extrasFromSettings(st.options, st.devices, st.keymaps, st.padmaps), st.devices);
      prevConn = null;   // dispositivos podem ter mudado: não confundir com controle desconectado
      return self;
    };
    app.transition(() => make(ret), FADE_MENU);
  };
  const pickStage = (ret: () => Screen): Screen => {
    app.audio.ensureMenus(MUSIC.menus);
    return stageScreen(app, {
      onPick: n => { ms.nextStage = n === ms.cfg.stage ? null : n; app.transition(ret, FADE_MENU); },
      onBack: () => { app.transition(ret, FADE_MENU); },
    });
  };
  /** Troca de personagem: vale na hora (só muda o desenho) e segue nas próximas rodadas. B volta sem trocar. */
  const pickChars = (ret: () => Screen): Screen => {
    app.audio.ensureMenus(MUSIC.menus);
    const chars = app.settings.setup.chars, before = [...chars];
    ms.cfg.chars.forEach((c, i) => { chars[i] = c; });
    return charactersScreen(app, {
      slots: ms.cfg.rules.active.map((on, i) => (!on ? 'off' : ms.cfg.humans[i] ? 'human' : 'cpu')),
      onDone: () => {
        ms.cfg.chars = [...chars];
        ms.match.chars = [...chars];
        for (const p of round.players) p.char = chars[p.slot] ?? p.char;
        app.transition(ret, FADE_MENU);
      },
      onBack: () => { before.forEach((c, i) => { chars[i] = c; }); app.transition(ret, FADE_MENU); },
    });
  };
  type Pending = NonNullable<MatchSession['nextRules']>;
  /** Guarda (ou tira, se voltou ao valor atual) uma regra que só vale da próxima rodada. */
  const setPending = <K extends keyof Pending>(key: K, v: NonNullable<Pending[K]>): void => {
    const cur = ms.cfg.rules[key], same = Array.isArray(v) ? v.every((x, i) => x === (cur as unknown[])[i]) : v === cur;
    const next: Pending = { ...ms.nextRules };
    if (same) delete next[key]; else next[key] = v;
    ms.nextRules = Object.keys(next).length ? next : null;
  };
  const pendingOr = <K extends keyof Pending>(key: K): NonNullable<Pending[K]> =>
    (ms.nextRules?.[key] ?? ms.cfg.rules[key]) as NonNullable<Pending[K]>;
  /** JOGADORES: Humano ↔ CPU vale na hora (a CPU assume ou devolve o boneco onde ele está); quem entra ou sai da partida,
   *  da próxima rodada. No modo equipes, as duas equipes precisam continuar com alguém. */
  const pickPlayers = (ret: () => Screen): Screen => {
    app.audio.ensureMenus(MUSIC.menus);
    const active = pendingOr('active');
    const slots: SlotKind[] = active.map((on, i) => (!on ? 'off' : ms.cfg.humans[i] ? 'human' : 'cpu'));
    const teams = ms.cfg.rules.teams;
    return playersScreen(app, {
      slots,
      ok: s => ms.cfg.rules.mode !== 'team' || [0, 1].every(t => s.some((k, i) => k !== 'off' && teams[i] === t)),
      onDone: () => {
        slots.forEach((k, i) => { if (k !== 'off') ms.cfg.humans[i] = k === 'human'; });
        setPending('active', slots.map(k => k !== 'off'));
        app.settings.setup.slots = [...slots];
        app.save();
        app.transition(ret, FADE_MENU);
      },
      onBack: () => { app.transition(ret, FADE_MENU); },
    });
  };
  /** REGRAS: abre com as da partida (não as do menu); nível da CPU e coroas valem na hora, o resto da próxima rodada.
   *  B volta sem mudar nada. */
  const pickRules = (ret: () => Screen): Screen => {
    const r = app.settings.setup.rules, before = { ...r };
    Object.assign(r, { cpuLevel: ms.cfg.rules.cpuLevel, matches: ms.cfg.rules.matches,
      timeIdx: pendingOr('timeIdx'), suddenDeath: pendingOr('suddenDeath'), badBomber: pendingOr('badBomber') });
    return rulesScreen(app, 0, {
      onDone: () => {
        for (const x of new Set([ms.cfg.rules, ms.match.rules, round.rules])) { x.cpuLevel = r.cpuLevel; x.matches = r.matches; }
        setPending('timeIdx', r.timeIdx); setPending('suddenDeath', r.suddenDeath); setPending('badBomber', r.badBomber);
        app.save();
        app.transition(ret, FADE_MENU);
      },
      onBack: () => { Object.assign(r, before); app.transition(ret, FADE_MENU); },
    });
  };
  const ACTIONS: Record<PauseItem, () => void> = {
    resume,
    players: () => { openSub(pickPlayers); },
    rules: () => { openSub(pickRules); },
    options: () => { openSub(ret => optionsScreen(app, 0, 'main', ret)); },
    controls: () => { openSub(ret => optionsScreen(app, 0, 'controls', ret)); },
    gameplay: () => { openSub(ret => optionsScreen(app, 0, 'gameplay', ret)); },
    stage: () => { openSub(pickStage); },
    chars: () => { openSub(pickChars); },
    quit: () => { quit(); },
    // todo mundo morre e a rodada segue sem pausa até o empate (tela de empate e a próxima rodada, placar intacto)
    draw: () => {
      const ev: ReturnType<typeof step> = [];
      if (endRoundDraw(round, ev)) { updateView(view, round, ev); fxUpdate(fx, round, ev, colorAt); app.audio.playEvents(ev); }
      resume();
    },
  };
  const pauseMenu = (): Menu => new Menu(PAUSE_ITEMS.map((id): MenuRow => ({ id, select: () => { ACTIONS[id](); } })));
  const pauseOverlay = () => (menu ? {
    items: PAUSE_ITEMS.map(id => S.battle.pauseMenu[id]), cursor: menu.cursor,
    note: ms.nextStage !== null ? S.battle.nextStageName(S.stage.names[ms.nextStage - 1] ?? '') : null,
    pending: ms.nextRules !== null,
  } : null);

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
      drawBattleOverlays(ctx, last.bank, { paused, disconnected, ...banners(), pauseMenu: pauseOverlay() });
    },
  };

  const self: BattleScreen = {
    id: 'battle', ms,
    get round() { return round; }, get paused() { return paused; }, get disconnected() { return disconnected; },
    get pauseMenu() { return menu ? { items: PAUSE_ITEMS, cursor: menu.cursor } : null; },
    banners,
    brightness: () => (round.phase === 'intro' ? introBrightness(phaseElapsed(round)) : 15),
    frozen: () => paused,
    fx: () => { fxShown = app.settings.options.fx; return fxShown ? fxFrame : null; },
    update(inp) {
      if (ended) return;
      // Só a borda conectado → desconectado de um humano com gamepad pausa (R19); quem já começa desligado, não.
      if (prevConn) for (let i = 0; i < 5; i++) {
        if (humanGp(i) && prevConn[i] && !inp.connected[i]) {
          if (!paused) pause();
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
        if (startEdge) { resume(); return; }
        if (combo) return;   // segurando para sair: o menu não anda
        // START já tratado acima (fecha o menu); B também fecha (CONTINUAR)
        const ev = menu?.update(inp.any & ~BTN.START, inp.pressedAny & ~BTN.START, app.audio);
        if (ev === 'back') resume();
        return;
      }
      if (startEdge) { pause(); return; }
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
      if (ms.cfg.devClock) drawFuseClock(ctx, round, fuseClock);
      drawBattleOverlays(ctx, bank, { paused, disconnected, ...banners(), pauseMenu: pauseOverlay() });
    },
  };
  return self;
}
