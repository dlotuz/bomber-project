import { BTN } from '../../../src/core';
import { rulesScreen } from '../../../src/screens/rules';
import { mkApp, press } from './helpers';

describe('regras', () => {
  it('ajusta valores com limites e alterna ligado/desligado', () => {
    const { app } = mkApp();
    const r = app.settings.setup.rules;
    app.go(rulesScreen(app));
    press(app, BTN.DOWN);                       // coroas
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(r.matches).toBe(5);
    press(app, BTN.UP); press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(r.cpuLevel).toBe(0);
    press(app, BTN.DOWN); press(app, BTN.DOWN); press(app, BTN.DOWN); // morte súbita
    press(app, BTN.RIGHT);
    expect(r.suddenDeath).toBe(true);
    press(app, BTN.A);
    expect(app.screen.id).toBe('characters');
  });
  it('B volta para jogadores', () => {
    const { app } = mkApp();
    app.go(rulesScreen(app));
    press(app, BTN.B);
    expect(app.screen.id).toBe('players');
  });
});
