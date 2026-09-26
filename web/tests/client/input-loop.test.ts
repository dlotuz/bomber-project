import {
  readKeyMap, readGamepad, readDevices, buildInput, emptyDevices, keyLabel, InputManager, DEFAULT_KEYMAPS,
  withEscapeAsBack, idleInput, type GamepadLike,
} from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/legacy-core';

const pad = (pressed: number[], axes: number[] = [0, 0]): GamepadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes,
});

describe('teclado', () => {
  it('mapeamento padrão dos dois teclados', () => {
    const down = new Set(['KeyW', 'KeyJ', 'ArrowLeft', 'Numpad3', 'NumpadEnter']);
    expect(readKeyMap(down, DEFAULT_KEYMAPS[0])).toBe(BTN.UP | BTN.A);
    expect(readKeyMap(down, DEFAULT_KEYMAPS[1])).toBe(BTN.LEFT | BTN.Y | BTN.START);
  });
  it('Enter é START do Teclado 1', () => {
    expect(readKeyMap(new Set(['Enter']), DEFAULT_KEYMAPS[0])).toBe(BTN.START);
  });
  it('nome legível das teclas', () => {
    expect(['KeyW', 'Digit7', 'Numpad2', 'ArrowUp', 'Space', 'Semicolon'].map(keyLabel))
      .toEqual(['W', '7', 'NUM 2', 'SETA CIMA', 'ESPAÇO', 'SEMICOLON']);
  });
});

describe('gamepad', () => {
  it('botões e d-pad', () => {
    expect(readGamepad(pad([1, 12]))).toBe(BTN.A | BTN.UP);
    expect(readGamepad(pad([0, 2, 9]))).toBe(BTN.B | BTN.Y | BTN.START);
    expect(readGamepad(pad([13, 14]))).toBe(BTN.DOWN | BTN.LEFT);
  });
  it('analógico com zona morta 0,5', () => {
    expect(readGamepad(pad([], [0.9, 0]))).toBe(BTN.RIGHT);
    expect(readGamepad(pad([], [0, -0.8]))).toBe(BTN.UP);
    expect(readGamepad(pad([], [0.3, 0.3]))).toBe(0);
  });
  it('sem gamepad = 0', () => {
    expect(readGamepad(null)).toBe(0);
  });
});

describe('dispositivos e atribuição', () => {
  it('lê os 2 teclados e os 4 controles', () => {
    const d = readDevices(new Set(['KeyD']), DEFAULT_KEYMAPS, [null, pad([1])]);
    expect(d).toEqual({ kb0: BTN.RIGHT, kb1: 0, gp0: 0, gp1: BTN.A, gp2: 0, gp3: 0, none: 0 });
  });
  it('cada jogador recebe o dispositivo atribuído; menus aceitam qualquer um', () => {
    const prev = emptyDevices();
    const cur = { ...emptyDevices(), kb0: BTN.A, gp3: BTN.START | BTN.UP };
    const inp = buildInput(cur, prev, ['gp3', 'kb0', 'none', 'gp0', 'kb0'], 'KeyJ');
    expect(inp.pads).toEqual([BTN.START | BTN.UP, BTN.A, 0, 0, BTN.A]);
    expect(inp.any).toBe(BTN.A | BTN.START | BTN.UP);
    expect(inp.pressedAny).toBe(BTN.A | BTN.START | BTN.UP);
    expect(inp.key).toBe('KeyJ');
  });
  it('bordas: botão segurado não conta como apertado de novo', () => {
    const held = { ...emptyDevices(), gp0: BTN.A };
    const inp = buildInput(held, held, ['gp0', 'kb0', 'kb1', 'gp1', 'gp2']);
    expect(inp.pads[0]).toBe(BTN.A);
    expect(inp.pressed[0]).toBe(0);
    expect(inp.pressedAny).toBe(0);
  });
});

describe('withEscapeAsBack', () => {
  it('Escape soma BTN.B ao pressedAny (e ao any), sem mudar mais nada', () => {
    const base = idleInput();
    base.key = 'Escape';
    base.pads = [BTN.UP, 0, 0, 0, 0];
    base.pressed = [BTN.UP, 0, 0, 0, 0];
    base.any = BTN.UP;
    base.pressedAny = BTN.UP;
    const out = withEscapeAsBack(base);
    expect(out.pressedAny).toBe(BTN.UP | BTN.B);
    expect(out.pads).toEqual(base.pads);
    expect(out.key).toBe('Escape');
  });
  it('sem Escape, devolve a entrada sem alterar', () => {
    const base = idleInput();
    base.pressedAny = BTN.A;
    expect(withEscapeAsBack(base)).toEqual(base);
  });
  it('não duplica o bit se B já estiver em pressedAny', () => {
    const base = idleInput();
    base.key = 'Escape';
    base.pressedAny = BTN.B;
    expect(withEscapeAsBack(base).pressedAny).toBe(BTN.B);
  });
});

describe('InputManager', () => {
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
  const make = () => { const t = new FakeTarget(); return { t, m: new InputManager(t, DEFAULT_KEYMAPS, () => []) }; };

  it('teclas do jogo viram botões e têm o padrão do navegador bloqueado', () => {
    const { t, m } = make();
    const ev = t.key('keydown', 'KeyW');
    expect(ev.prevented).toBe(true);
    expect(m.poll().kb0).toBe(BTN.UP);
    t.key('keyup', 'KeyW');
    expect(m.poll().kb0).toBe(0);
  });
  it('não interfere quando o foco está num campo de texto', () => {
    const { t, m } = make();
    const ev = t.key('keydown', 'KeyW', { target: { tagName: 'INPUT' } });
    expect(ev.prevented).toBe(false);
    expect(m.poll().kb0).toBe(0);
  });
  it('última tecla: uma vez por aperto, sem auto-repetição', () => {
    const { t, m } = make();
    t.key('keydown', 'KeyQ');
    expect(m.takeLastKey()).toBe('KeyQ');
    expect(m.takeLastKey()).toBeNull();
    t.key('keydown', 'KeyQ', { repeat: true });
    expect(m.takeLastKey()).toBeNull();
  });
  it('setKeymaps troca o mapeamento; dispose remove os ouvintes', () => {
    const { t, m } = make();
    m.setKeymaps([{ ...DEFAULT_KEYMAPS[0], up: 'KeyI' }, DEFAULT_KEYMAPS[1]]);
    t.key('keydown', 'KeyI');
    expect(m.poll().kb0).toBe(BTN.UP);
    m.dispose();
    expect([...t.handlers.values()].every(s => s.size === 0)).toBe(true);
  });
  it('perder o foco solta tudo', () => {
    const { t, m } = make();
    t.key('keydown', 'KeyW');
    t.fire('blur');
    expect(m.poll().kb0).toBe(0);
  });
});

describe('loop de passo fixo', () => {
  it('um frame de 1/60 s = 1 passo', () => {
    expect(stepsFor(0, STEP_MS).steps).toBe(1);
  });
  it('acumula frações', () => {
    const a = stepsFor(0, 10);
    expect(a.steps).toBe(0);
    const b = stepsFor(a.acc, 10);
    expect(b.steps).toBe(1);
    expect(b.acc).toBeCloseTo(20 - STEP_MS, 5);
  });
  it('limita a MAX_STEPS e descarta o atraso', () => {
    const r = stepsFor(0, 1000);
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.acc).toBeLessThanOrEqual(STEP_MS);
  });
  it('não deixa o jitter do rAF (±0.3ms) acumular passos extras ou faltantes', () => {
    let acc = 0;
    for (let i = 0; i < 600; i++) {
      const dt = STEP_MS + (i % 2 === 0 ? 0.3 : -0.3);
      const r = stepsFor(acc, dt);
      expect(r.steps).toBe(1);
      acc = r.acc;
    }
  });
});
