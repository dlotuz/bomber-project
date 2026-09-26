import { scoreboardScreen } from '../../src/screens/scoreboard';
import { createMatchSession, beginRound, endRound, resetCarry } from '../../src/game/match-session';
import { parseConfig, configFromSetup } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { CROWN_SPIN } from '../../src/game/timeline';
import { idleInput } from '../../src/input/input';
import { forceWin, runUntil, skipIntro, setCrowns } from './core-helpers';
import { mkApp, tap, idle, inputOf } from './helpers';
import { defaultSetup } from '../../src/app/settings';
import { ASSETS } from './rom';
import { scoreboardMaps } from '../../src/render/screens-rom/scoreboard';
import { loadCapture, capturedMap, mapMatch } from './captures';

beforeEach(() => resetCarry());

function afterWin(cfg = parseConfig('?players=3&humans=1'), crownsBefore = 0) {
  const env = mkApp();
  const ms = createMatchSession(cfg);
  setCrowns(ms.match, 0, crownsBefore);
  const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const sb = scoreboardScreen(env.app, ms); env.app.go(sb); env.sink.clear();
  return { ...env, ms, sb };
}

describe('placar (§6.10, R7, R8, A15)', () => {
  it('só as linhas dos slots ativos, na posição do slot', () => {
    const setup = { ...defaultSetup(), slots: ['human', 'off', 'cpu', 'off', 'cpu'] as const };
    const { sb } = afterWin(configFromSetup(setup, false, ['kb0', 'kb1', 'gp0', 'gp1', 'gp2']));
    expect(sb.rows()).toEqual([{ slot: 0, y: 56 }, { slot: 2, y: 120 }, { slot: 4, y: 184 }]);
  });
  it('coroa nova: casa preta até S=4, gira 104 f pela animação e para', () => {
    const { app, sb } = afterWin(undefined, 1);
    expect(sb.crownCell(0, 0)).toBe('full');
    idle(app, 4);  expect(sb.crownCell(0, 1)).toBe('empty');
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('spin:0');
    idle(app, 103); expect(sb.crownCell(0, 1)).toBe(`spin:${CROWN_SPIN.length - 1}`);
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('full');
    expect(sb.crownCell(1, 0)).toBe('empty');
  });
  it('pular: A/B/START a partir de S=18; próxima rodada depois de 15 + 288, com $2F +31 e $14 +43', () => {
    const { app, sink } = afterWin();
    idle(app, 17); tap(app, BTN.A);
    expect(app.inTransition).toBe(false);
    tap(app, BTN.B);
    expect(app.inTransition).toBe(true);
    const t0 = app.tick;
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(303);
    expect(sink.since(t0).map(c => [c.t, c.op, c.id])).toEqual([[31, 'bank', 0x2f], [43, 'music', 0x14]]);
  });
  it('sem botão: sai sozinho em S=511', () => {
    const { app } = afterWin();
    idle(app, 511); expect(app.inTransition).toBe(false);
    idle(app, 1); expect(app.inTransition).toBe(true);
  });
});

describe('placar final (§6.12, R9)', () => {
  it('não pula; $16 em S=511; a vitória assume em S=557 sem fade', () => {
    const { app, sink } = afterWin(parseConfig('?players=2&humans=1&matches=1'));
    for (let k = 0; k < 511; k++) app.update(inputOf(BTN.A | BTN.START, BTN.A | BTN.START));
    expect([app.inTransition, sink.of('music')]).toEqual([false, []]);
    idle(app, 1);
    expect(sink.of('music').map(c => c.id)).toEqual([0x16]);
    idle(app, 45); expect(app.screen.id).toBe('scoreboard');
    idle(app, 1);
    expect([app.screen.id, app.inTransition]).toEqual(['victory', false]);
  });
});

describe.skipIf(!ASSETS)('coroa da ROM (R10)', () => {
  it('C3:DA94 tem 32 quadros e 104 f, como a spec', () => {
    const anim = ASSETS!.anim(0xc3da94);
    expect(anim.map(f => f.dur)).toEqual([...CROWN_SPIN]);
  });
});

describe.skipIf(!ASSETS || !loadCapture('scoreboard'))('fundo × captura (A14, §7.5)', () => {
  it('BG1/BG2 montados batem ≥ 97 % com a captura, fora da faixa do título (40,16)–(220,56)', () => {
    const cap = loadCapture('scoreboard')!;
    const maps = scoreboardMaps();
    const ignore = [{ x0: 40, y0: 16, x1: 220, y1: 56 }];
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const built = maps[layer];
      if (!built) continue;
      expect(mapMatch(built, capturedMap(cap, addr), ignore), layer).toBeGreaterThanOrEqual(0.97);
    }
  });
});

