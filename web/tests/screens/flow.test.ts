import { titleScreen } from '../../src/screens/title';
import type { battleScreen } from '../../src/screens/battle';
import { carry, resetCarry } from '../../src/game/match-session';
import { BTN } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { forceWin, forceClock } from './core-helpers';
import { mkApp, press, tap, settle } from './helpers';
import type { App } from '../../src/app/app';

beforeEach(() => resetCarry());
const until = (app: App, id: string) => { for (let n = 0; n < 5000 && app.screen.id !== id; n++) app.update(idleInput()); expect(app.screen.id).toBe(id); };
const step = (app: App, btn: number, id: string, slot?: number) => { press(app, btn, slot); settle(app); expect(app.screen.id).toBe(id); };

describe('fluxo completo com entrada simulada (aceite do plano 10)', () => {
  it('título → jogadores → regras → personagens → fase → partida → placar final → vitória → fase', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app));
    step(app, BTN.A, 'players'); step(app, BTN.A, 'rules');
    press(app, BTN.DOWN); press(app, BTN.LEFT); press(app, BTN.LEFT);            // Coroas 3 → 1
    step(app, BTN.A, 'characters');
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app); expect(app.screen.id).toBe('stage');
    press(app, BTN.A); until(app, 'battle');
    const b = app.screen as ReturnType<typeof battleScreen>;
    while (b.round.phase === 'intro') app.update(idleInput());
    forceWin(b.round, 0);
    until(app, 'scoreboard'); until(app, 'victory');
    tap(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('stage');
    expect(carry.seed).not.toBeNull();
    const musics = sink.of('music').map(c => c.id);
    for (const m of [0x01, 0x12, 0x13, 0x14, 0x15, 0x16]) expect(musics).toContain(m);
  });
  it('rodada empatada por tempo → EMPATE → A → próxima rodada', () => {
    const { app } = mkApp();
    app.settings.setup.stage = 1;
    app.go(titleScreen(app));
    step(app, BTN.A, 'players'); step(app, BTN.A, 'rules'); step(app, BTN.A, 'characters');
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app);
    press(app, BTN.A); until(app, 'battle');
    let b = app.screen as ReturnType<typeof battleScreen>;
    while (b.round.phase === 'intro') app.update(idleInput());
    forceClock(b.round, 1);
    until(app, 'draw');
    for (let k = 0; k < 20; k++) app.update(idleInput());
    tap(app, BTN.A); until(app, 'battle');
    b = app.screen as ReturnType<typeof battleScreen>;
    expect(b.ms.roundNo).toBe(2);
  });
  it('partida só de CPU: START de qualquer controle pausa', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'cpu', 'off', 'off', 'off'];
    app.go(titleScreen(app));
    step(app, BTN.A, 'players'); step(app, BTN.A, 'rules'); step(app, BTN.A, 'characters');
    press(app, BTN.A); press(app, BTN.A); settle(app);
    press(app, BTN.A); until(app, 'battle');
    const b = app.screen as ReturnType<typeof battleScreen>;
    tap(app, BTN.START);
    expect(b.paused).toBe(true);
  });
});

describe('sink real registrado pelo plano 11 (registerAudioFactory)', () => {
  it('sem fábrica, startRealAudio devolve false; com ela, troca o sink e repete banco e música', async () => {
    const { AudioDirector, registerAudioFactory, startRealAudio } = await import('../../src/app/audio');
    const { RecordingSink } = await import('./helpers');
    const d = new AudioDirector();
    d.bank(0x30); d.music(0x01);
    expect(await startRealAudio(d)).toBe(false);
    const real = new RecordingSink();
    registerAudioFactory(async () => real);
    expect(await startRealAudio(d)).toBe(true);
    expect(real.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
  });
});
