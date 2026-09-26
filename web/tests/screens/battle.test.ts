import { battleScreen } from '../../src/screens/battle';
import { drawBattleOverlays } from '../../src/render/draw-screens';
import { createMatchSession, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { setGameEventAudio } from '../../src/app/audio';
import { BTN, crownsOf, eventType, matchRngState } from '../../src/game/core-api';
import { FADE_OUT_1 } from '../../src/app/fade';
import { idleInput } from '../../src/input/input';
import { forceWin, forceAllDead, forceClock } from './core-helpers';
import { mkApp, tap, idle, inputOf, brightnessTrace, range, settle } from './helpers';
import type { App } from '../../src/app/app';

beforeEach(() => resetCarry());

function start(q = '?players=3&humans=1') {
  const env = mkApp();
  const ms = createMatchSession(parseConfig(q));
  const b = battleScreen(env.app, ms);
  env.app.go(b);
  return { ...env, ms, b };
}
const toPlay = (app: App, b: ReturnType<typeof battleScreen>) => { while (b.round.phase === 'intro') app.update(idleInput()); };
function untilTransition(app: App): number {
  for (let n = 0; n < 4000 && !app.inTransition; n++) app.update(idleInput());
  expect(app.inTransition).toBe(true);
  return app.tick;
}
function untilScreen(app: App, id: string): number {
  for (let n = 0; n < 4000 && app.screen.id !== id; n++) app.update(idleInput());
  expect(app.screen.id).toBe(id);
  return app.tick;
}
const calls = (sink: ReturnType<typeof mkApp>['sink'], t0: number, until = Infinity) =>
  sink.since(t0).filter(c => c.t < until).map(c => [c.t, c.op, c.id]);

describe('intro (§6.8)', () => {
  it('10 frames pretos, fade-in de 15; o 62º passo põe play', () => {
    const { app, b } = start();
    expect(brightnessTrace(app, 27)).toEqual([...Array(10).fill(0), ...range(1, 15), 15, 15]);
    idle(app, 34);
    expect(b.round.phase).toBe('intro');
    idle(app, 1);
    expect(b.round.phase).toBe('play');
  });
});

describe('pausa (§6.9, R17, R18)', () => {
  it('START de qualquer controle pausa e despausa com $04; núcleo e animação param; nada escurece', () => {
    const { app, sink, b } = start();
    toPlay(app, b); sink.clear();
    const tick = b.round.tick, frame = app.frame;
    tap(app, BTN.START);
    expect(b.paused).toBe(true);
    idle(app, 30);
    expect([b.round.tick, app.frame, app.brightness()]).toEqual([tick, frame, 15]);
    tap(app, BTN.START);
    expect(b.paused).toBe(false);
    expect(sink.of('sfx').map(c => c.id)).toEqual([4, 4]);
  });
  it('pausa também no intro: o brilho e os passos param', () => {
    const { app, b } = start();
    idle(app, 12);
    tap(app, BTN.START);
    const br = app.brightness(), tick = b.round.tick;
    idle(app, 10);
    expect([app.brightness(), b.round.tick]).toEqual([br, tick]);
  });
  it('SELECT+START por 60 f volta à fase; com SELECT segurado o START não despausa', () => {
    const { app, sink, b, ms } = start();
    toPlay(app, b); tap(app, BTN.START); sink.clear();
    const combo = BTN.SELECT | BTN.START;
    for (let k = 0; k < 59; k++) app.update(inputOf(combo, k === 0 ? combo : 0));
    app.update(idleInput());
    expect([b.paused, app.inTransition]).toEqual([true, false]);
    for (let k = 0; k < 60; k++) app.update(inputOf(combo, k === 0 ? combo : 0));
    expect(app.inTransition).toBe(true);
    const t0 = app.tick;
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(calls(sink, t0).filter(c => c[1] !== 'sfx')).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [58, 'music', 0x12]]);
    expect(carry.seed).toBe(matchRngState(ms.match));
  });
  it('Esc segurado 60 f na pausa também sai', () => {
    const { app, b } = start();
    toPlay(app, b); tap(app, BTN.START);
    for (let k = 0; k < 60; k++) app.update(inputOf(0, 0, undefined, { esc: true }));
    expect(app.inTransition).toBe(true);
  });
});

describe('controle desconectado (§6.9, R19)', () => {
  it('gamepad de humano desconecta: pausa com $04 e "CONTROLE 1"; START de outro controle volta', () => {
    const { app, sink, b, ms } = start();
    ms.cfg.devices[0] = 'gp0';
    toPlay(app, b); sink.clear();
    app.update(inputOf(0, 0, undefined, { connected: [false, true, true, true, true] }));
    expect([b.paused, b.disconnected]).toEqual([true, 1]);
    tap(app, BTN.START);
    expect([b.paused, b.disconnected]).toEqual([false, null]);
    expect(sink.of('sfx').map(c => c.id)).toEqual([4, 4]);
  });
  it('já desconectado no início não pausa; slot de CPU com gamepad também não', () => {
    const { app, b, ms } = start();
    ms.cfg.devices[0] = 'gp0';
    const off = { connected: [false, true, false, true, true] };
    for (let k = 0; k < 5; k++) app.update(inputOf(0, 0, undefined, off));
    expect(b.paused).toBe(false);
  });
});

describe('faixas (§6.9, R27, R28)', () => {
  it('RÁPIDO!!: entra pela direita a 2 px/f por 192 ticks e congela na pausa', () => {
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 62);
    idle(app, 1);
    expect(b.banners().hurry).toEqual({ x: 256, y: 120 });
    idle(app, 10);
    expect(b.banners().hurry!.x).toBe(236);
    tap(app, BTN.START); idle(app, 20); tap(app, BTN.START);
    expect(b.banners().hurry!.x).toBe(236);
    idle(app, 181);
    expect(b.banners().hurry).not.toBeNull();
    idle(app, 1);
    expect(b.banners().hurry).toBeNull();
  });
  it('TEMPO ESGOTADO!: cai de −16 a 104 em 16 f e fica', () => {
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 1);
    idle(app, 1);
    expect(b.banners().timeUp).toEqual({ y: -16, text: 'TEMPO ESGOTADO!' });
    idle(app, 16); expect(b.banners().timeUp!.y).toBe(104);
    idle(app, 50); expect(b.banners().timeUp!.y).toBe(104);
  });
  it('os eventos de cada passo vão para o mapeador de áudio (R26)', () => {
    const seen: string[] = [];
    setGameEventAudio((_s, ev) => { seen.push(...ev.map(eventType)); });
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 62);
    idle(app, 1);
    expect(seen).toContain('hurry');
    setGameEventAudio(() => {});
  });
});

describe('fim de rodada (§6.10, §6.11, R4–R6)', () => {
  it('vitória: FADE, fade-out 15, +1 coroa no 1º frame do preto, $30 +16, $15 +57 e placar em +63', () => {
    const { app, sink, b, ms } = start();
    toPlay(app, b); forceWin(b.round, 0); sink.clear();
    const t0 = untilTransition(app);
    expect(b.round.phase).toBe('over');
    expect(brightnessTrace(app, 14)).toEqual(FADE_OUT_1.slice(1));
    expect(crownsOf(ms.match)[0]).toBe(0);
    idle(app, 1);
    expect(crownsOf(ms.match)[0]).toBe(1);
    expect(untilScreen(app, 'scoreboard') - t0).toBe(63);
    expect(calls(sink, t0)).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [57, 'music', 0x15]]);
  });
  it('EMPATE por tempo: FADE +1, $30 +58, $18 +68 e a tela EMPATE em +166', () => {
    const { app, sink, b } = start();
    toPlay(app, b); forceClock(b.round, 1); sink.clear();
    const t0 = untilTransition(app);
    expect(untilScreen(app, 'draw') - t0).toBe(166);
    expect(calls(sink, t0)).toEqual([[1, 'fade', undefined], [58, 'bank', 0x30], [68, 'music', 0x18]]);
  });
  it('EMPATE com todos mortos: FADE +0, $30 +16, $18 +26 e EMPATE em +63', () => {
    const { app, sink, b } = start();
    toPlay(app, b); forceAllDead(b.round); sink.clear();
    const t0 = untilTransition(app);
    expect(untilScreen(app, 'draw') - t0).toBe(63);
    expect(calls(sink, t0)).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [26, 'music', 0x18]]);
  });
});

describe('camadas por cima da partida (fallback)', () => {
  const env = () => {
    const tags: string[] = []; let fills = 0;
    const ctx = { drawImage: (im: { tag: string }) => tags.push(im.tag), fillRect: () => { fills++; }, fillStyle: '' };
    const bank = { text: (s: string, c: string) => ({ width: s.length * 6 + 1, height: 12, tag: `${s}|${c}` }) };
    return { tags, fills: () => fills, ctx: ctx as never, bank: bank as never };
  };
  it('pausa: só "PAUSA!" e nenhum escurecimento', () => {
    const e = env();
    drawBattleOverlays(e.ctx, e.bank, { paused: true, disconnected: null, hurry: null, timeUp: null });
    expect([e.tags, e.fills()]).toEqual([['PAUSA!|#3fd84a'], 0]);
  });
  it('desconexão acrescenta a linha ASCII', () => {
    const e = env();
    drawBattleOverlays(e.ctx, e.bank, { paused: true, disconnected: 2, hurry: null, timeUp: null });
    expect(e.tags).toEqual(['PAUSA!|#3fd84a', 'CONTROLE 2 DESCONECTADO|#ffffff']);
  });
});
