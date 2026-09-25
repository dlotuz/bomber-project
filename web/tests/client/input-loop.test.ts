import { readKeyboard, readGamepad, mergePads, DEFAULT_KEYMAPS, type GamepadLike } from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/core';

const pad = (pressed: number[], axes: number[] = [0, 0]): GamepadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes,
});

describe('teclado', () => {
  it('mapeamento padrão de P1 e P2', () => {
    const out = readKeyboard(new Set(['KeyW', 'KeyJ', 'ArrowLeft', 'Numpad3', 'NumpadEnter']), DEFAULT_KEYMAPS);
    expect(out).toEqual([BTN.UP | BTN.A, BTN.LEFT | BTN.Y | BTN.START, 0, 0, 0]);
  });
  it('Enter é START do P1', () => {
    expect(readKeyboard(new Set(['Enter']), DEFAULT_KEYMAPS)[0]).toBe(BTN.START);
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
  it('sem gamepad = 0; mergePads soma com o teclado por índice', () => {
    expect(readGamepad(null)).toBe(0);
    expect(mergePads([BTN.UP, 0, 0, 0, 0], [null, pad([1])])).toEqual([BTN.UP, BTN.A, 0, 0, 0]);
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
});
