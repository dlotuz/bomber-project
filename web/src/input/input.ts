import { BTN } from '../core';

export interface KeyMap { up: string; down: string; left: string; right: string; a: string; b: string; y: string; start: string }

/** Spec §11: P1 WASD + J/K/L + Enter; P2 setas + Numpad1/2/3 + NumpadEnter. */
export const DEFAULT_KEYMAPS: KeyMap[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyK', y: 'KeyL', start: 'Enter' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Numpad1', b: 'Numpad2', y: 'Numpad3', start: 'NumpadEnter' },
];

export function readKeyboard(down: ReadonlySet<string>, maps: readonly KeyMap[]): number[] {
  const out = [0, 0, 0, 0, 0];
  maps.slice(0, 5).forEach((m, i) => {
    let v = 0;
    if (down.has(m.up)) v |= BTN.UP;
    if (down.has(m.down)) v |= BTN.DOWN;
    if (down.has(m.left)) v |= BTN.LEFT;
    if (down.has(m.right)) v |= BTN.RIGHT;
    if (down.has(m.a)) v |= BTN.A;
    if (down.has(m.b)) v |= BTN.B;
    if (down.has(m.y)) v |= BTN.Y;
    if (down.has(m.start)) v |= BTN.START;
    out[i] = v;
  });
  return out;
}

export interface GamepadLike { buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number> }

const DEAD_ZONE = 0.5;

/** Layout "standard" da Gamepad API: A = 1 (direita), B = 0 (baixo), Y = 2 (esquerda), START = 9, d-pad 12–15. */
export function readGamepad(gp: GamepadLike | null): number {
  if (!gp) return 0;
  const b = (i: number) => !!gp.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  let v = 0;
  if (b(12) || ay < -DEAD_ZONE) v |= BTN.UP;
  if (b(13) || ay > DEAD_ZONE) v |= BTN.DOWN;
  if (b(14) || ax < -DEAD_ZONE) v |= BTN.LEFT;
  if (b(15) || ax > DEAD_ZONE) v |= BTN.RIGHT;
  if (b(1)) v |= BTN.A;
  if (b(0)) v |= BTN.B;
  if (b(2)) v |= BTN.Y;
  if (b(9)) v |= BTN.START;
  return v;
}

export function mergePads(kb: number[], gps: (GamepadLike | null)[]): number[] {
  return kb.map((v, i) => v | readGamepad(gps[i] ?? null));
}

export class InputManager {
  private down = new Set<string>();
  private gameKeys: Set<string>;

  constructor(target: Window, private maps: KeyMap[] = DEFAULT_KEYMAPS) {
    this.gameKeys = new Set(maps.flatMap(m => Object.values(m)));
    target.addEventListener('keydown', e => {
      if (this.gameKeys.has(e.code)) e.preventDefault();
      this.down.add(e.code);
    });
    target.addEventListener('keyup', e => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  poll(): number[] {
    const gps = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    return mergePads(readKeyboard(this.down, this.maps), gps as (GamepadLike | null)[]);
  }
}
