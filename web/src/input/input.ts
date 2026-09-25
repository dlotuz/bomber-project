import { BTN } from '../core';

export interface KeyMap { up: string; down: string; left: string; right: string; a: string; b: string; y: string; start: string }

export const KEY_FIELDS: readonly (keyof KeyMap)[] = ['up', 'down', 'left', 'right', 'a', 'b', 'y', 'start'];

/** Spec §11: Teclado 1 = WASD + J/K/L + Enter; Teclado 2 = setas + Numpad1/2/3 + NumpadEnter. */
export const DEFAULT_KEYMAPS: readonly KeyMap[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyK', y: 'KeyL', start: 'Enter' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Numpad1', b: 'Numpad2', y: 'Numpad3', start: 'NumpadEnter' },
];

/** Dispositivos de entrada que podem ser atribuídos a um jogador. */
export type DeviceId = 'kb0' | 'kb1' | 'gp0' | 'gp1' | 'gp2' | 'gp3' | 'none';
export const DEVICE_IDS: readonly DeviceId[] = ['kb0', 'kb1', 'gp0', 'gp1', 'gp2', 'gp3', 'none'];
export type DeviceState = Record<DeviceId, number>;

export function emptyDevices(): DeviceState {
  return { kb0: 0, kb1: 0, gp0: 0, gp1: 0, gp2: 0, gp3: 0, none: 0 };
}

export function readKeyMap(down: ReadonlySet<string>, m: KeyMap): number {
  let v = 0;
  if (down.has(m.up)) v |= BTN.UP;
  if (down.has(m.down)) v |= BTN.DOWN;
  if (down.has(m.left)) v |= BTN.LEFT;
  if (down.has(m.right)) v |= BTN.RIGHT;
  if (down.has(m.a)) v |= BTN.A;
  if (down.has(m.b)) v |= BTN.B;
  if (down.has(m.y)) v |= BTN.Y;
  if (down.has(m.start)) v |= BTN.START;
  return v;
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

export function readDevices(down: ReadonlySet<string>, maps: readonly KeyMap[], gps: readonly (GamepadLike | null)[]): DeviceState {
  return {
    kb0: maps[0] ? readKeyMap(down, maps[0]) : 0,
    kb1: maps[1] ? readKeyMap(down, maps[1]) : 0,
    gp0: readGamepad(gps[0] ?? null), gp1: readGamepad(gps[1] ?? null),
    gp2: readGamepad(gps[2] ?? null), gp3: readGamepad(gps[3] ?? null),
    none: 0,
  };
}

/** Entrada de um tick já resolvida: por jogador (via atribuição de dispositivo) e de qualquer dispositivo (menus). */
export interface MenuInput {
  pads: number[];      // botões segurados, por jogador
  pressed: number[];   // botões recém-apertados, por jogador
  any: number;         // OR de todos os dispositivos
  pressedAny: number;  // recém-apertados em qualquer dispositivo
  key: string | null;  // última tecla física apertada neste tick (para remapear)
}

export function buildInput(cur: DeviceState, prev: DeviceState, assign: readonly DeviceId[], key: string | null = null): MenuInput {
  const edge = (d: DeviceId) => cur[d] & ~prev[d];
  let any = 0, pressedAny = 0;
  for (const d of DEVICE_IDS) { any |= cur[d]; pressedAny |= edge(d); }
  return { pads: assign.map(d => cur[d]), pressed: assign.map(d => edge(d)), any, pressedAny, key };
}

export function idleInput(): MenuInput {
  return { pads: [0, 0, 0, 0, 0], pressed: [0, 0, 0, 0, 0], any: 0, pressedAny: 0, key: null };
}

/** Escape = voltar em qualquer menu (também cancela a captura de tecla no remapeamento, que lê `key` direto). */
export function withEscapeAsBack(inp: MenuInput): MenuInput {
  if (inp.key !== 'Escape' || (inp.pressedAny & BTN.B) !== 0) return inp;
  return { ...inp, pressedAny: inp.pressedAny | BTN.B };
}

/** Nome legível de uma tecla (KeyboardEvent.code) para a tela de remapeamento. */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `NUM ${code.slice(6)}`;
  const named: Record<string, string> = {
    ArrowUp: 'SETA CIMA', ArrowDown: 'SETA BAIXO', ArrowLeft: 'SETA ESQ', ArrowRight: 'SETA DIR',
    Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Space: 'ESPAÇO', Tab: 'TAB', Backspace: 'BACKSPACE',
    ShiftLeft: 'SHIFT ESQ', ShiftRight: 'SHIFT DIR', ControlLeft: 'CTRL ESQ', ControlRight: 'CTRL DIR',
    AltLeft: 'ALT ESQ', AltRight: 'ALT DIR',
  };
  return named[code] ?? (code.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 10) || '?');
}

export interface KeyTarget {
  addEventListener(type: string, fn: EventListener): void;
  removeEventListener(type: string, fn: EventListener): void;
}
interface KeyEventLike { code: string; repeat?: boolean; target?: unknown; preventDefault(): void }

function isEditable(t: unknown): boolean {
  const el = t as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  if (!el) return false;
  return el.isContentEditable === true || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

function browserGamepads(): (GamepadLike | null)[] {
  return typeof navigator !== 'undefined' && navigator.getGamepads ? (Array.from(navigator.getGamepads()) as (GamepadLike | null)[]) : [];
}

export class InputManager {
  private down = new Set<string>();
  private gameKeys = new Set<string>();
  private lastKey: string | null = null;
  private maps: KeyMap[] = [];

  private onDown = (e: KeyEventLike) => {
    if (isEditable(e.target)) return;
    if (this.gameKeys.has(e.code)) e.preventDefault();
    this.down.add(e.code);
    if (!e.repeat) this.lastKey = e.code;
  };
  private onUp = (e: KeyEventLike) => { this.down.delete(e.code); };
  private onBlur = () => { this.down.clear(); };

  constructor(private target: KeyTarget, maps: readonly KeyMap[] = DEFAULT_KEYMAPS,
    private gamepads: () => readonly (GamepadLike | null)[] = browserGamepads) {
    this.setKeymaps(maps);
    target.addEventListener('keydown', this.onDown as unknown as EventListener);
    target.addEventListener('keyup', this.onUp as unknown as EventListener);
    target.addEventListener('blur', this.onBlur);
  }

  setKeymaps(maps: readonly KeyMap[]): void {
    this.maps = maps.map(m => ({ ...m }));
    this.gameKeys = new Set(this.maps.flatMap(m => Object.values(m)));
  }

  poll(): DeviceState {
    return readDevices(this.down, this.maps, this.gamepads());
  }

  /** Última tecla apertada (sem auto-repetição) desde a chamada anterior. */
  takeLastKey(): string | null {
    const k = this.lastKey;
    this.lastKey = null;
    return k;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown as unknown as EventListener);
    this.target.removeEventListener('keyup', this.onUp as unknown as EventListener);
    this.target.removeEventListener('blur', this.onBlur);
    this.down.clear();
  }
}
