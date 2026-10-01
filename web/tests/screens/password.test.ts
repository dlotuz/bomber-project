vi.mock('../../src/app/rom-api', async orig => ({
  ...(await orig<typeof import('../../src/app/rom-api')>()), openRomDialog: vi.fn(), forgetStoredRom: vi.fn(async () => {}),
}));
import { optionsScreen } from '../../src/screens/options';
import { passwordScreen } from '../../src/screens/password';
import { configFromSetup, parseConfig } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { mkApp, press, settle } from './helpers';

function type(app: ReturnType<typeof mkApp>['app'], pw: ReturnType<typeof passwordScreen>, code: string): void {
  [...code].forEach((c, i) => {
    pw.menu.cursor = i;
    for (let k = 0; k < Number(c); k++) press(app, BTN.RIGHT);
  });
  pw.menu.cursor = 4;
  press(app, BTN.A);
}

describe('senha (Opções → Jogabilidade)', () => {
  it('vem ligada; a linha SENHA abre a tela; 0164 desliga e de novo liga', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'gameplay'); app.go(o);
    o.menu.cursor = o.rowIds().indexOf('password');
    expect(app.settings.options.allMounts).toBe(true);
    expect(o.value('password')).toBe('LIGADA');
    press(app, BTN.A); settle(app);
    const pw = app.screen as ReturnType<typeof passwordScreen>;
    expect(pw.id).toBe('password');
    type(app, pw, '0164');
    expect(app.settings.options.allMounts).toBe(false);
    expect(pw.note).toBe('TODAS AS MONTARIAS: NÃO');
    type(app, pw, '0000');   // os dígitos continuam 0164 (+0)
    expect(app.settings.options.allMounts).toBe(true);
    expect(pw.note).toBe('TODAS AS MONTARIAS: SIM');
  });
  it('senha errada não muda nada; ←/→ dá a volta em 0–9', () => {
    const { app } = mkApp();
    const pw = passwordScreen(app, 0); app.go(pw);
    type(app, pw, '1234');
    expect(app.settings.options.allMounts).toBe(true);
    expect(pw.note).toBe('SENHA ERRADA');
    pw.menu.cursor = 0; press(app, BTN.LEFT);
    expect(pw.digits[0]).toBe(0);
    press(app, BTN.LEFT);
    expect(pw.digits[0]).toBe(9);
  });
  it('partida rápida: 13 tipos por padrão, allmounts=0 desliga', () => {
    expect(parseConfig('?quick').rules.allMounts).toBe(true);
    expect(parseConfig('?quick&allmounts=0').rules.allMounts).toBe(false);
  });
  it('a opção chega às regras da partida', () => {
    const { app } = mkApp();
    app.settings.options.allMounts = true;
    const cfg = configFromSetup(app.settings.setup, false, app.settings.devices, null, { allMounts: app.settings.options.allMounts });
    expect(cfg.rules.allMounts).toBe(true);
  });
});
