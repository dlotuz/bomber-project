import { BTN } from '../../../src/core';
import { charactersScreen, AUTO_ADVANCE_FRAMES } from '../../../src/screens/characters';
import { mkApp, press, idle } from './helpers';

describe('personagens', () => {
  it('cada humano move o próprio cursor com o próprio controle e confirma', () => {
    const { app } = mkApp();
    const scr = charactersScreen(app);
    app.go(scr);
    press(app, BTN.RIGHT, 0);
    press(app, BTN.DOWN, 1);
    expect(app.settings.setup.chars.slice(0, 2)).toEqual([1, 4]);
    press(app, BTN.A, 0);
    expect(scr.locked.slice(0, 2)).toEqual([true, false]);
    press(app, BTN.RIGHT, 0);                   // travado: não mexe
    expect(app.settings.setup.chars[0]).toBe(1);
    press(app, BTN.B, 0);
    expect(scr.locked[0]).toBe(false);
  });
  it('CPUs já começam prontas; com todos prontos, START segue para a fase', () => {
    const { app } = mkApp();
    const scr = charactersScreen(app);
    app.go(scr);
    expect(scr.locked).toEqual([false, false, true, true, true]);
    press(app, BTN.A, 0); press(app, BTN.A, 1);
    expect(app.screen.id).toBe('characters');
    press(app, BTN.START);
    expect(app.screen.id).toBe('stage');
  });
  it('segue sozinho depois de um tempo com todos prontos', () => {
    const { app } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.A, 0); press(app, BTN.A, 1);
    idle(app, AUTO_ADVANCE_FRAMES);
    expect(app.screen.id).toBe('stage');
  });
  it('humano sem controle atribuído fica pronto automaticamente', () => {
    const { app } = mkApp();
    app.settings.devices[1] = 'none';
    const scr = charactersScreen(app);
    app.go(scr);
    expect(scr.locked[1]).toBe(true);
  });
  it('B de quem ainda escolhe, sem ninguém travado, volta para regras', () => {
    const { app } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.B, 1);
    expect(app.screen.id).toBe('rules');
  });
  it('B de qualquer dispositivo volta para regras mesmo com os controles dos humanos desconectados', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'human', 'off', 'off', 'off'];
    app.settings.devices = ['gp2', 'gp3', 'gp0', 'gp1', 'none'];
    app.go(charactersScreen(app));
    press(app, BTN.B); // nenhum slot: um dispositivo não atribuído a ninguém aperta B
    expect(app.screen.id).toBe('rules');
  });
});
