import { BTN } from '../../../src/core';
import { titleScreen } from '../../../src/screens/title';
import { mkApp, press } from './helpers';

describe('título e modos', () => {
  it('título: BATALHA é a primeira opção', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A);
    expect(app.screen.id).toBe('vs');
  });
  it('título → CONFIGURAÇÕES', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.DOWN); press(app, BTN.START);
    // T15: options.ts substitui settings-screen.ts (apagado); title.ts (T8, ainda não mesclada aqui) já aponta
    // para optionsScreen (id 'options'). Este arquivo é apagado pela própria T8.
    expect(app.screen.id).toBe('options');
  });
  it('VS → Battle Royale → Batalha em Times grava o modo e vai para jogadores; B volta', () => {
    const { app, saves } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A); press(app, BTN.A);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.DOWN); press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(app.settings.setup.mode).toBe('team');
    expect(saves()).toBeGreaterThan(0);
    press(app, BTN.B);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.B); press(app, BTN.B);
    expect(app.screen.id).toBe('title');
  });
});
