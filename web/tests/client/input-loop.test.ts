import {
  readKeyMap, readGamepad, readDevices, buildInput, emptyDevices, keyLabel, InputManager, DEFAULT_KEYMAPS, DEFAULT_PADMAP,
  withEscapeAsBack, idleInput, padLabel, type GamepadLike, type KeyTarget,
} from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/game/core-api';

const pad = (pressed: number[], axes: number[] = [0, 0], connected = true): GamepadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes, connected,
});

describe('teclado (spec §2.6, R16)', () => {
  it('P1: WASD + J(A) K(B) L(Y) I(X) Enter(START) Q(L) E(R) F(SELECT)', () => {
    const m = DEFAULT_KEYMAPS[0];
    expect([m.up, m.down, m.left, m.right, m.a, m.b, m.y, m.x, m.start, m.l, m.r, m.select])
      .toEqual(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyI', 'Enter', 'KeyQ', 'KeyE', 'KeyF']);
  });
  it('P2: setas + Numpad1(A) 2(B) 3(Y) 5(X) Enter(START) 7(L) 9(R) 0(SELECT)', () => {
    const m = DEFAULT_KEYMAPS[1];
    expect([m.up, m.down, m.left, m.right, m.a, m.b, m.y, m.x, m.start, m.l, m.r, m.select])
      .toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad5', 'NumpadEnter', 'Numpad7', 'Numpad9', 'Numpad0']);
  });
  it('lê os 12 botões', () => {
    const down = new Set(['KeyW', 'KeyJ', 'KeyI', 'KeyQ', 'KeyE', 'KeyF']);
    expect(readKeyMap(down, DEFAULT_KEYMAPS[0])).toBe(BTN.UP | BTN.A | BTN.X | BTN.L | BTN.R | BTN.SELECT);
  });
  it('nome legível das teclas', () => {
    expect(['KeyW', 'Digit7', 'Numpad2', 'ArrowUp', 'Space', 'Semicolon'].map(keyLabel))
      .toEqual(['W', '7', 'NUM 2', 'SETA CIMA', 'ESPAÇO', 'SEMICOLON']);
  });
});

describe('gamepad (standard, remapeável)', () => {
  it('padrão: A=1 B=0 Y=2 X=3 L=4 R=5 SELECT=8 START=9, direcional 12–15', () => {
    expect(DEFAULT_PADMAP).toEqual({ a: 1, b: 0, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 });
    expect(readGamepad(pad([1, 12]))).toBe(BTN.A | BTN.UP);
    expect(readGamepad(pad([0, 2, 3, 9]))).toBe(BTN.B | BTN.Y | BTN.X | BTN.START);
    expect(readGamepad(pad([4, 5, 8]))).toBe(BTN.L | BTN.R | BTN.SELECT);
  });
  it('mapa trocado: A no botão 0 e B no 1', () => {
    expect(readGamepad(pad([0]), { ...DEFAULT_PADMAP, a: 0, b: 1 })).toBe(BTN.A);
  });
  it('analógico com zona morta 0,5 continua valendo como direcional', () => {
    expect(readGamepad(pad([], [0.9, 0]))).toBe(BTN.RIGHT);
    expect(readGamepad(pad([], [0.3, 0.3]))).toBe(0);
  });
  it('rótulo de botão', () => { expect(padLabel(9)).toBe('BOTÃO 9'); });
});

describe('dispositivos, conexão e atribuição', () => {
  it('buildInput: por jogador, qualquer dispositivo, conexão por jogador, Esc e botão bruto', () => {
    const cur = { ...emptyDevices(), kb0: BTN.A, gp1: BTN.START };
    const inp = buildInput(cur, emptyDevices(), ['kb0', 'gp1', 'gp0', 'none', 'kb1'], 'KeyJ',
      { connected: { gp0: false, gp1: true }, esc: true, padButton: { pad: 1, button: 9 } });
    expect(inp.pads).toEqual([BTN.A, BTN.START, 0, 0, 0]);
    expect(inp.connected).toEqual([true, true, false, false, true]);   // teclados sempre; 'none' nunca
    expect(inp.esc).toBe(true);
    expect(inp.padButton).toEqual({ pad: 1, button: 9 });
  });
  it('sem extra: todos os gamepads contam como conectados (compatível com o main.ts atual)', () => {
    const inp = buildInput(emptyDevices(), emptyDevices(), ['gp0', 'gp1', 'gp2', 'gp3', 'none']);
    expect(inp.connected).toEqual([true, true, true, true, false]);
    expect(inp.esc).toBe(false);
    expect(inp.padButton).toBeNull();
  });
  it('idleInput tem os campos novos', () => {
    expect(idleInput()).toMatchObject({ connected: [true, true, true, true, true], esc: false, padButton: null });
  });
  it('readDevices usa os mapas de gamepad', () => {
    // DEFAULT_PADMAP.b já é 0: sem mover 'b' também, o botão 0 acionaria A e B ao mesmo tempo.
    const d = readDevices(new Set(), DEFAULT_KEYMAPS, [pad([0])], [{ ...DEFAULT_PADMAP, a: 0, b: 1 }]);
    expect(d.gp0).toBe(BTN.A);
  });
});

describe('withEscapeAsBack', () => {
  it('Escape vira B em qualquer dispositivo', () => {
    const i = { ...idleInput(), key: 'Escape' };
    expect(withEscapeAsBack(i).pressedAny & BTN.B).toBe(BTN.B);
  });
});

function fakeTarget() {
  const fns = new Map<string, EventListener>();
  const t: KeyTarget & { fire(type: string, code: string, repeat?: boolean): void } = {
    addEventListener: (ty, fn) => { fns.set(ty, fn); },
    removeEventListener: ty => { fns.delete(ty); },
    fire: (ty, code, repeat = false) => fns.get(ty)?.({ code, repeat, preventDefault() {} } as unknown as Event),
  };
  return t;
}

describe('InputManager', () => {
  it('poll lê teclas e gamepads com os mapas; connected() e escHeld()', () => {
    const gps: (GamepadLike | null)[] = [pad([1]), null, pad([], [0, 0], false)];
    const t = fakeTarget();
    const im = new InputManager(t, DEFAULT_KEYMAPS, () => gps);
    t.fire('keydown', 'KeyJ'); t.fire('keydown', 'Escape');
    expect(im.poll().kb0).toBe(BTN.A);
    expect(im.poll().gp0).toBe(BTN.A);
    expect(im.connected()).toMatchObject({ kb0: true, kb1: true, gp0: true, gp1: false, gp2: false, none: false });
    expect(im.escHeld()).toBe(true);
    t.fire('keyup', 'Escape');
    expect(im.escHeld()).toBe(false);
  });
  it('takePadButton: primeiro botão bruto recém-apertado desde a última leitura', () => {
    let gps: (GamepadLike | null)[] = [pad([]), pad([])];
    const im = new InputManager(fakeTarget(), DEFAULT_KEYMAPS, () => gps);
    im.poll();
    gps = [pad([]), pad([7])];
    im.poll();
    expect(im.takePadButton()).toEqual({ pad: 1, button: 7 });
    expect(im.takePadButton()).toBeNull();
    im.poll();                                  // continua segurado: não é novo
    expect(im.takePadButton()).toBeNull();
  });
  it('setPadmaps troca o mapa usado no poll', () => {
    const im = new InputManager(fakeTarget(), DEFAULT_KEYMAPS, () => [pad([0])]);
    im.setPadmaps([{ ...DEFAULT_PADMAP, a: 0, b: 1 }]);
    expect(im.poll().gp0).toBe(BTN.A);
  });
});

describe('loop de passo fixo', () => {
  it('passos por frame e teto', () => {
    expect(stepsFor(0, STEP_MS).steps).toBe(1);
    expect(stepsFor(0, 1000).steps).toBe(MAX_STEPS);
  });
});
