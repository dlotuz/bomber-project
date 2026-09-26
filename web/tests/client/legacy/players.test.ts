import { BTN } from '../../../src/core';
import { playersScreen, ERROR_FRAMES } from '../../../src/screens/players';
import { mkApp, press, idle } from './helpers';

describe('jogadores', () => {
  it('ESQ/DIR alterna Humano → CPU → Desligado', () => {
    const { app } = mkApp();
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('cpu');
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('off');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(app.settings.setup.slots[0]).toBe('human');
  });
  it('nos times, a opção inclui o time', () => {
    const { app } = mkApp();
    app.settings.setup.mode = 'team';
    app.settings.setup.teams[0] = 0;
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['human', 1]);
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['cpu', 0]);
  });
  it('formação inválida mostra erro e não avança; válida vai para regras', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    const scr = playersScreen(app) as ReturnType<typeof playersScreen> & { error: string };
    app.go(scr);
    press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(scr.error).toBe('PRECISA DE 2 JOGADORES');
    idle(app, ERROR_FRAMES);
    expect(scr.error).toBe('');
    press(app, BTN.DOWN); press(app, BTN.LEFT); // 2º jogador: desligado → CPU
    press(app, BTN.A);
    expect(app.screen.id).toBe('rules');
  });
});
