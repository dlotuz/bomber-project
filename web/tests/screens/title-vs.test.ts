import { titleScreen } from '../../src/screens/title';
import { modeScreen } from '../../src/screens/vs';
import { buildTitleScene, TITLE_TEXT_RECTS } from '../../src/render/screens-rom/title';
import { BTN } from '../../src/game/core-api';
import { FADE_OUT_2, FADE_OUT_12 } from '../../src/app/fade';
import { mkApp, press, tap, idle, settle, brightnessTrace } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, parseOam, mapMatch } from './captures';

type Title = ReturnType<typeof titleScreen>;
const calls = (sink: { since(t: number): { t: number; op: string; id?: number }[] }, t0: number) => sink.since(t0).map(c => [c.t, c.op, c.id]);

describe('título (§6.2, R22)', () => {
  it('ao entrar: banco $30 e música $01; cursor em "BATTLE GAME", a única opção', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app));
    expect(sink.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
    expect((app.screen as Title).cursor).toBe(0);
  });
  it('↑/↓ tocam $01 e o cursor fica em "BATTLE GAME"', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    press(app, BTN.DOWN); press(app, BTN.UP);
    expect([t.cursor, sink.of('sfx').map(c => c.id)]).toEqual([0, [1, 1]]);
  });
  it('B, ←, →, X, Y, L, R e SELECT não fazem nada', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    for (const b of [BTN.B, BTN.LEFT, BTN.RIGHT, BTN.X, BTN.Y, BTN.L, BTN.R, BTN.SELECT]) press(app, b);
    expect([t.cursor, sink.calls.length, app.inTransition]).toEqual([0, 0, false]);
  });
  it('A em "BATTLE GAME": $02, saída de 2 f por passo, grava "Todos contra Todos" e abre jogadores no f58 com a música $12', () => {
    const { app, sink } = mkApp();
    app.settings.setup.mode = 'team';
    app.go(titleScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    expect(app.brightness()).toBe(14);
    expect(brightnessTrace(app, 28)).toEqual(FADE_OUT_2.slice(1));
    settle(app);
    expect([app.screen.id, app.settings.setup.mode]).toEqual(['players', 'ffa']);
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 2], [58, 'music', 0x12]]);
  });
  it('"APERTE START!" pisca 64 f aceso / 64 f apagado', () => {
    const { app } = mkApp();
    const t = titleScreen(app); app.go(t);
    idle(app, 1); expect(t.pressStartVisible()).toBe(true);
    idle(app, 64); expect(t.pressStartVisible()).toBe(false);
    idle(app, 64); expect(t.pressStartVisible()).toBe(true);
  });
});

describe('modo (§6.3, R31)', () => {
  it('modo → B: $03, saída de 12 f, título com cursor em "BATTLE GAME" e música $01 no f58', () => {
    const { app, sink } = mkApp();
    app.go(modeScreen(app)); sink.clear();
    tap(app, BTN.B);
    const t0 = app.tick;
    expect(brightnessTrace(app, 11)).toEqual(FADE_OUT_12.slice(1));
    settle(app);
    expect([app.screen.id, (app.screen as Title).cursor]).toEqual(['title', 0]);
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 3], [58, 'music', 0x01]]);
  });
  it('modo lembra "Em Equipes"; A grava o modo e vai a jogadores', () => {
    const { app, saves } = mkApp();
    app.settings.setup.mode = 'team';
    const m = modeScreen(app); app.go(m);
    expect(m.cursor).toBe(1);
    press(app, BTN.UP); press(app, BTN.A); settle(app);
    expect([app.screen.id, app.settings.setup.mode]).toEqual(['players', 'ffa']);
    expect(saves()).toBeGreaterThan(0);
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
