import { racerScreen } from '../../src/screens/racer';
import { createMatchSession, beginRound, endRound, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro } from './core-helpers';
import { mkApp, tap, idle, settle } from './helpers';

beforeEach(() => resetCarry());
function race() {
  const env = mkApp();
  const ms = createMatchSession(parseConfig('?players=2&humans=1&matches=1&racer=1'));
  const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const rc = racerScreen(env.app, ms); env.app.go(rc);
  return { ...env, rc };
}

describe('Corrida Bônus (R20)', () => {
  it('B acelera 24 (teto 64); atrito 1 por frame; posição += velocidade/8', () => {
    const { app, rc } = race();
    tap(app, BTN.B);
    expect([rc.speed, rc.pos]).toEqual([23, 3]);
    for (let k = 0; k < 5; k++) tap(app, BTN.B);
    expect(rc.speed).toBe(63);
  });
  it('sem B: acaba no frame 900; prêmio pelo RNG do jogo ($0012 → índice 4, semente $42B9)', () => {
    const { app, rc } = race();
    idle(app, 899); expect(rc.finished).toBe(false);
    idle(app, 1);
    expect([rc.finished, rc.pos, rc.prize]).toEqual([true, 0, 4]);
    expect(carry).toEqual({ seed: 0x42b9, racerPrize: { slot: 0, prize: 4 } });
  });
  it('apertando B toda hora chega antes do tempo', () => {
    const { app, rc } = race();
    let n = 0;
    while (!rc.finished && n < 900) { tap(app, BTN.B); n++; }
    expect(rc.finished).toBe(true);
    expect(n).toBeLessThan(900);
    expect(rc.pos).toBeGreaterThanOrEqual(4096);
  });
  it('prêmio na tela por 180 f ou até um botão; depois a fase', () => {
    const { app } = race();
    idle(app, 900); idle(app, 179);
    expect(app.inTransition).toBe(false);
    idle(app, 1);
    expect(app.inTransition).toBe(true);
    settle(app);
    expect(app.screen.id).toBe('stage');
    const b = race();
    idle(b.app, 900); tap(b.app, BTN.A);
    expect(b.app.inTransition).toBe(true);
  });
});
