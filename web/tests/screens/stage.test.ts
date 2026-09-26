import { stageScreen } from '../../src/screens/stage';
import { BTN } from '../../src/game/core-api';
import type { MatchSession } from '../../src/game/match-session';
import { idleInput } from '../../src/input/input';
import { buildStageScene } from '../../src/render/screens-rom/stagesel';
import { mkApp, press, tap, idle, hold, settle } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, mapMatch, type Rect } from './captures';

describe('seleção de fase (§6.7)', () => {
  it('→: $01 no botão, faixa rola 8 px/f por 16 f, o número troca no fim, com volta 10 → 1', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 10;
    const st = stageScreen(app); app.go(st); sink.clear();
    tap(app, BTN.RIGHT);
    expect([st.scroll(), st.stage]).toEqual([0, 10]);
    idle(app, 1); expect(st.scroll()).toBe(-8);
    idle(app, 14); expect([st.scroll(), st.stage]).toEqual([-120, 10]);
    idle(app, 1); expect([st.scroll(), st.stage]).toEqual([0, 1]);
    expect([app.settings.setup.stage, sink.of('sfx').map(c => c.id)]).toEqual([1, [1]]);
  });
  it('← anda para o outro lado, com volta 1 → 10', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.LEFT); idle(app, 1);
    expect(st.scroll()).toBe(8);
    idle(app, 15);
    expect(st.stage).toBe(10);
  });
  it('segurar: 36 f e depois a cada 21 f', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    hold(app, BTN.RIGHT, 100);                     // pulsos em 0, 36, 57 e 78
    expect(st.stage).toBe(5);
  });
  it('↑/↓ não fazem nada', () => {
    const { app, sink } = mkApp();
    const st = stageScreen(app); app.go(st); sink.clear();
    press(app, BTN.UP); press(app, BTN.DOWN);
    expect([st.stage, st.scroll(), sink.calls.length]).toEqual([1, 0, 0]);
  });
  it('A: $02 f0, $13 f48, voz $07 f208, fade-out f278, FADE f310, $2F f511, $14 f523 e partida em f646', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 3;
    app.go(stageScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    idle(app, 277);
    expect(app.inTransition).toBe(false);
    idle(app, 1);
    expect([app.inTransition, app.brightness()]).toEqual([true, 14]);
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(646);
    expect(sink.since(t0).filter(c => c.t < 646).map(c => [c.t, c.op, c.id])).toEqual([
      [0, 'sfx', 2], [48, 'music', 0x13], [208, 'voice', 0x07], [310, 'fade', undefined], [511, 'bank', 0x2f], [523, 'music', 0x14]]);
    expect((app.screen as unknown as { ms: MatchSession }).ms.cfg.stage).toBe(3);
  });
  it('"BATALHA!" pisca de f65 a f207 e fica de f208 a f277; o título sobe de f48 a f64; entradas ignoradas', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.A);
    idle(app, 56); expect(st.titleDy()).toBe(-16);
    idle(app, 9); expect([st.seqF, st.battleVisible()]).toEqual([65, true]);
    idle(app, 1); expect(st.battleVisible()).toBe(false);
    press(app, BTN.B); press(app, BTN.RIGHT);
    expect([app.inTransition, st.stage]).toEqual([false, 1]);
    idle(app, 150); expect(st.battleVisible()).toBe(true);
  });
  it('B → personagens com $03; em Equipes → equipes (R12)', () => {
    const a = mkApp();
    a.app.go(stageScreen(a.app)); a.sink.clear();
    press(a.app, BTN.B); settle(a.app);
    expect([a.app.screen.id, a.sink.of('sfx')[0].id]).toEqual(['characters', 3]);
    const b = mkApp();
    b.app.settings.setup.mode = 'team';
    b.app.go(stageScreen(b.app)); press(b.app, BTN.B); settle(b.app);
    expect(b.app.screen.id).toBe('teams');
  });
});

// R29: as prévias de $C1:A901 não foram reconstruídas para as 10 fases (só a fase 1, medida na captura
// `stagesel`); fora da faixa das miniaturas (0,36)–(255,160) e dos textos, `buildStageScene` deve bater com a
// captura real — o fundo de quebra-cabeça (BG2) é o mesmo dos outros menus (MENU_GEO.bgPattern, T5).
describe.skipIf(!ASSETS || !loadCapture('stagesel'))('prévias × captura stagesel (R29)', () => {
  it('BG1/BG2 batem ≥ 97% fora dos textos e da faixa das miniaturas', () => {
    const cap = loadCapture('stagesel')!;
    const maps = buildStageScene(ASSETS!, 1, 0);
    const ignore: Rect[] = [
      { x0: 60, y0: 0, x1: 196, y1: 28 },     // título "Escolha a fase!"
      { x0: 40, y0: 146, x1: 216, y1: 200 },  // "Fase N" e o nome
      { x0: 0, y0: 36, x1: 255, y1: 160 },    // R29: faixa das miniaturas (não reconstruída para as 10 fases)
    ];
    expect(mapMatch(maps.bg2!, capturedMap(cap, 0x4400), ignore)).toBeGreaterThanOrEqual(0.97);
    expect(mapMatch(maps.bg1!, capturedMap(cap, 0x4000), ignore)).toBeGreaterThanOrEqual(0.97);
  });
});
