import { App } from '../../../src/app/app';
import { defaultSettings } from '../../../src/app/settings';
import { idleInput, buildInput, InputManager, emptyDevices, type DeviceState } from '../../../src/input/input';
import { BTN } from '../../../src/core';
import { settingsScreen, namesScreen, remapScreen } from '../../../src/screens/settings-screen';
import { COLORS } from '../../../src/screens/ui';
import { mkApp, press } from './helpers';

describe('configurações', () => {
  it('troca o controle de um jogador e grava', () => {
    const { app, saves } = mkApp();
    app.go(settingsScreen(app));
    press(app, BTN.RIGHT);
    expect(app.settings.devices[0]).toBe('kb1');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(app.settings.devices[0]).toBe('none');
    expect(saves()).toBe(3);
  });
  it('dispositivo atribuído a mais de um jogador aparece em vermelho', () => {
    const { app } = mkApp();
    app.settings.devices = ['kb0', 'kb0', 'gp0', 'gp1', 'none'];
    const scr = settingsScreen(app);
    const calls: { text: string; color: string }[] = [];
    const bank = { text: (s: string, color: string) => { calls.push({ text: s, color }); return { width: s.length * 6, height: 10 }; } };
    const ctx = { fillStyle: '', fillRect() {}, drawImage() {} };
    scr.draw(ctx as unknown as CanvasRenderingContext2D, bank as unknown as import('../../../src/render/sprite-bank').SpriteBank, 0);
    const duped = calls.filter(c => c.text === 'TECLADO 1');
    expect(duped.length).toBeGreaterThan(0);
    expect(duped.every(c => c.color === COLORS.error)).toBe(true);
    const single = calls.filter(c => c.text === 'CONTROLE 1');
    expect(single.length).toBeGreaterThan(0);
    expect(single.every(c => c.color === COLORS.value)).toBe(true);
  });
  it('restaurar padrão volta controles, teclas e nomes', () => {
    const { app, keymaps } = mkApp();
    app.settings.devices[0] = 'gp3';
    app.settings.names[0] = 'X';
    app.settings.keymaps[0].up = 'KeyI';
    app.go(settingsScreen(app));
    for (let k = 0; k < 8; k++) press(app, BTN.DOWN);  // RESTAURAR PADRÃO
    press(app, BTN.A);
    expect(app.settings.devices[0]).toBe('kb0');
    expect(app.settings.names[0]).toBe('');
    expect(app.settings.keymaps[0].up).toBe('KeyW');
    expect(keymaps).toHaveLength(1);
  });
  it('edita um nome letra a letra', () => {
    const { app } = mkApp();
    const scr = namesScreen(app);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.editing).toBe(0);
    press(app, BTN.UP);               // ' ' → 'A'
    press(app, BTN.A);                // próxima posição
    press(app, BTN.DOWN);             // ' ' → '-'
    press(app, BTN.DOWN);             // '-' → '9'
    press(app, BTN.START);
    expect(scr.editing).toBe(-1);
    expect(app.settings.names[0]).toBe('A9');
  });
  it('B cancela a edição sem gravar', () => {
    const { app } = mkApp();
    const scr = namesScreen(app);
    app.go(scr);
    press(app, BTN.A); press(app, BTN.UP); press(app, BTN.B);
    expect(scr.editing).toBe(-1);
    expect(app.settings.names[0]).toBe('');
  });
  it('remapeia uma tecla; ESC cancela', () => {
    const { app, keymaps } = mkApp();
    const scr = remapScreen(app, 0);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.capturing).toBe('up');
    const k = idleInput(); k.key = 'KeyI';
    app.update(k);
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].up).toBe('KeyI');
    expect(keymaps).toHaveLength(1);
    press(app, BTN.A);
    const esc = idleInput(); esc.key = 'Escape';
    app.update(esc);
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].up).toBe('KeyI');
  });
});

describe('remap não se dispara de novo com a tecla ainda segurada', () => {
  class FakeTarget {
    handlers = new Map<string, Set<EventListener>>();
    addEventListener(t: string, fn: EventListener) { if (!this.handlers.has(t)) this.handlers.set(t, new Set()); this.handlers.get(t)!.add(fn); }
    removeEventListener(t: string, fn: EventListener) { this.handlers.get(t)?.delete(fn); }
    fire(t: string, e: object = {}) { for (const fn of this.handlers.get(t) ?? []) fn(e as Event); }
    key(t: 'keydown' | 'keyup', code: string, extra: object = {}) {
      const ev = { code, prevented: false, preventDefault() { ev.prevented = true; }, ...extra };
      this.fire(t, ev);
      return ev;
    }
  }

  function setup() {
    const settings = defaultSettings();
    const t = new FakeTarget();
    const input = new InputManager(t, settings.keymaps, () => []);
    const app = new App(settings, { save: () => {}, setKeymaps: m => input.setKeymaps(m), seed: () => 1 });
    let prev: DeviceState = emptyDevices();
    const drive = () => {
      const cur = input.poll();
      app.update(buildInput(cur, prev, app.settings.devices, input.takeLastKey()));
      prev = cur;
    };
    const tapKey = (code: string) => { t.key('keydown', code); drive(); t.key('keyup', code); drive(); };
    return { app, t, drive, tapKey };
  }

  it('remapear B para uma tecla segurada não sai do remap nem recaptura', () => {
    const { app, t, drive, tapKey } = setup();
    const scr = remapScreen(app, 0);
    app.go(scr);
    // KEY_FIELDS = up, down, left, right, a, b, y, start; 'b' está no índice 5.
    for (let i = 0; i < 5; i++) tapKey('KeyS'); // baixo (kb0) 5x
    tapKey('KeyJ'); // A (kb0): entra em captura no campo 'b'
    expect(scr.capturing).toBe('b');
    t.key('keydown', 'KeyX'); // segura a tecla nova sem soltar
    drive(); // tick da captura: grava b = KeyX, entra em modo "ignorar até soltar"
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].b).toBe('KeyX');
    for (let i = 0; i < 5; i++) drive(); // KeyX ainda segurada, agora mapeada para B
    expect(app.screen.id).toBe('remap');
    expect(scr.capturing).toBeNull();
    t.key('keyup', 'KeyX');
    drive();
  });

  it('remapear A para a mesma tecla não reentra em captura imediatamente', () => {
    const { app, t, drive, tapKey } = setup();
    const scr = remapScreen(app, 0);
    app.go(scr);
    for (let i = 0; i < 5; i++) tapKey('KeyS'); // até 'b'
    tapKey('KeyJ');
    t.key('keydown', 'KeyX');
    drive();
    t.key('keyup', 'KeyX');
    drive(); // solta: sai do modo "ignorar"
    tapKey('KeyW'); // sobe uma linha: volta para 'a'
    tapKey('KeyJ'); // captura 'a'
    expect(scr.capturing).toBe('a');
    t.key('keydown', 'KeyX'); // mesma tecla já usada em 'b'
    drive(); // grava a = KeyX também
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].a).toBe('KeyX');
    for (let i = 0; i < 5; i++) drive(); // KeyX segurada mapeia A e B ao mesmo tempo
    expect(scr.capturing).toBeNull();
    expect(app.screen.id).toBe('remap');
    t.key('keyup', 'KeyX');
    drive();
  });
});
