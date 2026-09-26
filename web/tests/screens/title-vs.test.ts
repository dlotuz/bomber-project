import { titleScreen } from '../../src/screens/title';
import { vsModeScreen, modeScreen } from '../../src/screens/vs';
import { buildTitleScene, TITLE_TEXT_RECTS } from '../../src/render/screens-rom/title';
import { BTN } from '../../src/game/core-api';
import { FADE_OUT_2, FADE_OUT_12 } from '../../src/app/fade';
import { mkApp, press, tap, idle, settle, brightnessTrace } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, parseOam, mapMatch } from './captures';

type Title = ReturnType<typeof titleScreen>;
const calls = (sink: { since(t: number): { t: number; op: string; id?: number }[] }, t0: number) => sink.since(t0).map(c => [c.t, c.op, c.id]);

describe('título (§6.2, R22)', () => {
  it('ao entrar: banco $30 e música $01; cursor em "Jogo de Batalha"', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app));
    expect(sink.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
    expect((app.screen as Title).cursor).toBe(1);
  });
  it('↑/↓ com volta, pulando "Jogo Normal"; SFX $01', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    press(app, BTN.DOWN); expect(t.cursor).toBe(2);
    press(app, BTN.DOWN); expect(t.cursor).toBe(1);
    press(app, BTN.UP); expect(t.cursor).toBe(2);
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1, 1]);
  });
  it('B, ←, →, X, Y, L, R e SELECT não fazem nada', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    for (const b of [BTN.B, BTN.LEFT, BTN.RIGHT, BTN.X, BTN.Y, BTN.L, BTN.R, BTN.SELECT]) press(app, b);
    expect([t.cursor, sink.calls.length, app.inTransition]).toEqual([1, 0, false]);
  });
  it('A em "Jogo de Batalha": $02, saída de 2 f por passo, VS no f58 com a música $12', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    expect(app.brightness()).toBe(14);
    expect(brightnessTrace(app, 28)).toEqual(FADE_OUT_2.slice(1));
    settle(app);
    expect(app.screen.id).toBe('vs');
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 2], [58, 'music', 0x12]]);
  });
  it('START em "Opções" abre as opções sem trocar a música', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app)); press(app, BTN.DOWN); sink.clear();
    tap(app, BTN.START); settle(app);
    expect(app.screen.id).toBe('options');
    expect(sink.of('music')).toEqual([]);
  });
  it('"APERTE START!" pisca 64 f aceso / 64 f apagado', () => {
    const { app } = mkApp();
    const t = titleScreen(app); app.go(t);
    idle(app, 1); expect(t.pressStartVisible()).toBe(true);
    idle(app, 64); expect(t.pressStartVisible()).toBe(false);
    idle(app, 64); expect(t.pressStartVisible()).toBe(true);
  });
  it('cursor inicial configurável (Opções → título volta em "Opções")', () => {
    const { app } = mkApp();
    app.go(titleScreen(app, { cursor: 2 }));
    expect((app.screen as Title).cursor).toBe(2);
  });
});

describe('VS e modo (§6.3, R31)', () => {
  it('VS: só "Battle Royale" é selecionável; ↓ toca $01 e o cursor fica', () => {
    const { app, sink } = mkApp();
    const v = vsModeScreen(app); app.go(v); sink.clear();
    press(app, BTN.DOWN);
    expect([v.cursor, sink.of('sfx').map(c => c.id)]).toEqual([0, [1]]);
  });
  it('VS → B: $03, saída de 12 f, título com cursor em "Jogo de Batalha" e música $01 no f58', () => {
    const { app, sink } = mkApp();
    app.go(vsModeScreen(app)); sink.clear();
    tap(app, BTN.B);
    const t0 = app.tick;
    expect(brightnessTrace(app, 11)).toEqual(FADE_OUT_12.slice(1));
    settle(app);
    expect([app.screen.id, (app.screen as Title).cursor]).toEqual(['title', 1]);
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 3], [58, 'music', 0x01]]);
  });
  it('VS → A → modo, que lembra "Em Equipes"; A grava o modo e vai a jogadores', () => {
    const { app, saves } = mkApp();
    app.settings.setup.mode = 'team';
    app.go(vsModeScreen(app));
    press(app, BTN.A); settle(app);
    expect([app.screen.id, (app.screen as ReturnType<typeof modeScreen>).cursor]).toEqual(['mode', 1]);
    press(app, BTN.UP); press(app, BTN.A); settle(app);
    expect([app.screen.id, app.settings.setup.mode]).toEqual(['players', 'ffa']);
    expect(saves()).toBeGreaterThan(0);
  });
  it('modo → B volta ao VS com $03', () => {
    const { app, sink } = mkApp();
    app.go(modeScreen(app)); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['vs', 3]);
  });
});

describe.skipIf(!ASSETS || !loadCapture('title'))('título com ROM × captura', () => {
  it('BG ≥ 97 % fora dos textos; cada OBJ do logo existe no OAM capturado', () => {
    const cap = loadCapture('title')!;
    const sc = buildTitleScene(ASSETS!);
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const m = sc.maps[layer];
      if (m) expect(mapMatch(m, capturedMap(cap, addr), TITLE_TEXT_RECTS, ...sc.scroll[layer]), layer).toBeGreaterThanOrEqual(0.97);
    }
    const rows = parseOam(cap.oam);
    for (const o of sc.logo) {
      const tile = (o.src as { tile: number }).tile;
      expect(rows.some(r => r.x === o.x && r.y === o.y && r.tile === tile && r.pal === o.pal), `OBJ ${o.x},${o.y}`).toBe(true);
    }
  });
});
