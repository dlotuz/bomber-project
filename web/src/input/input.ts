import { BTN } from '../game/core-api';

export interface KeyMap {
  up: string; down: string; left: string; right: string; a: string; b: string; x: string; y: string;
  l: string; r: string; start: string; select: string;
}

export const KEY_FIELDS: readonly (keyof KeyMap)[] = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];

/** Spec §11/R16: Teclado 1 = WASD + J/K/L/I + Enter + Q/E/F; Teclado 2 = setas + Numpad1/2/3/5 + NumpadEnter + 7/9/0. */
export const DEFAULT_KEYMAPS: readonly KeyMap[] = [
  {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyK', y: 'KeyL', x: 'KeyI',
    start: 'Enter', l: 'KeyQ', r: 'KeyE', select: 'KeyF',
  },
  {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Numpad1', b: 'Numpad2',
    y: 'Numpad3', x: 'Numpad5', start: 'NumpadEnter', l: 'Numpad7', r: 'Numpad9', select: 'Numpad0',
  },
];

/** Dispositivos de entrada que podem ser atribuídos a um jogador. */
export type DeviceId = 'kb0' | 'kb1' | 'gp0' | 'gp1' | 'gp2' | 'gp3' | 'none';
export const DEVICE_IDS: readonly DeviceId[] = ['kb0', 'kb1', 'gp0', 'gp1', 'gp2', 'gp3', 'none'];
export type DeviceState = Record<DeviceId, number>;

export function emptyDevices(): DeviceState {
  return { kb0: 0, kb1: 0, gp0: 0, gp1: 0, gp2: 0, gp3: 0, none: 0 };
}

const FIELD_BTN: Record<keyof KeyMap, number> = {
  up: BTN.UP, down: BTN.DOWN, left: BTN.LEFT, right: BTN.RIGHT, a: BTN.A, b: BTN.B, x: BTN.X, y: BTN.Y,
  l: BTN.L, r: BTN.R, start: BTN.START, select: BTN.SELECT,
};

export function readKeyMap(down: ReadonlySet<string>, m: KeyMap): number {
  let v = 0;
  for (const f of KEY_FIELDS) if (down.has(m[f])) v |= FIELD_BTN[f];
  return v;
}

export interface GamepadLike { buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number>; connected?: boolean }

/** Mapa dos 12 botões lógicos para os índices de botão do layout "standard" da Gamepad API (remapeável). */
export interface PadMap {
  up: number; down: number; left: number; right: number; a: number; b: number; x: number; y: number;
  l: number; r: number; start: number; select: number;
}

export const PAD_FIELDS: readonly (keyof PadMap)[] = KEY_FIELDS;

/** Layout "standard" da Gamepad API: A = 1, B = 0, Y = 2, X = 3, L = 4, R = 5, SELECT = 8, START = 9, d-pad 12–15. */
export const DEFAULT_PADMAP: PadMap = {
  a: 1, b: 0, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15,
};

const DEAD_ZONE = 0.5;

export function readGamepad(gp: GamepadLike | null, map: PadMap = DEFAULT_PADMAP): number {
  if (!gp) return 0;
  const b = (i: number) => !!gp.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  let v = 0;
  if (b(map.up) || ay < -DEAD_ZONE) v |= BTN.UP;
  if (b(map.down) || ay > DEAD_ZONE) v |= BTN.DOWN;
  if (b(map.left) || ax < -DEAD_ZONE) v |= BTN.LEFT;
  if (b(map.right) || ax > DEAD_ZONE) v |= BTN.RIGHT;
  if (b(map.a)) v |= BTN.A;
  if (b(map.b)) v |= BTN.B;
  if (b(map.y)) v |= BTN.Y;
  if (b(map.x)) v |= BTN.X;
  if (b(map.l)) v |= BTN.L;
  if (b(map.r)) v |= BTN.R;
  if (b(map.select)) v |= BTN.SELECT;
  if (b(map.start)) v |= BTN.START;
  return v;
}

/** Nome legível de um índice de botão bruto (Gamepad API) para a tela de remapeamento. */
export function padLabel(i: number): string {
  return `BOTÃO ${i}`;
}

export function readDevices(
  down: ReadonlySet<string>, maps: readonly KeyMap[], gps: readonly (GamepadLike | null)[],
  padmaps: readonly PadMap[] = [],
): DeviceState {
  return {
    kb0: maps[0] ? readKeyMap(down, maps[0]) : 0,
    kb1: maps[1] ? readKeyMap(down, maps[1]) : 0,
    gp0: readGamepad(gps[0] ?? null, padmaps[0] ?? DEFAULT_PADMAP),
    gp1: readGamepad(gps[1] ?? null, padmaps[1] ?? DEFAULT_PADMAP),
    gp2: readGamepad(gps[2] ?? null, padmaps[2] ?? DEFAULT_PADMAP),
    gp3: readGamepad(gps[3] ?? null, padmaps[3] ?? DEFAULT_PADMAP),
    none: 0,
  };
}

/** Entrada de um tick já resolvida: por jogador (via atribuição de dispositivo) e de qualquer dispositivo (menus). */
export interface MenuInput {
  pads: number[];              // botões segurados, por jogador
  pressed: number[];           // botões recém-apertados, por jogador
  any: number;                 // OR de todos os dispositivos
  pressedAny: number;          // recém-apertados em qualquer dispositivo
  key: string | null;          // última tecla física apertada neste tick (para remapear)
  connected: boolean[];        // dispositivo do jogador está conectado (teclado: sempre; 'none': nunca)
  esc: boolean;                // Esc está segurado neste tick
  padButton: { pad: number; button: number } | null;   // 1º botão bruto de gamepad recém-apertado (remapeamento)
}

export function buildInput(
  cur: DeviceState, prev: DeviceState, assign: readonly DeviceId[], key: string | null = null,
  extra: { connected?: Partial<Record<DeviceId, boolean>>; esc?: boolean; padButton?: { pad: number; button: number } | null } = {},
): MenuInput {
  const edge = (d: DeviceId) => cur[d] & ~prev[d];
  let any = 0, pressedAny = 0;
  for (const d of DEVICE_IDS) { any |= cur[d]; pressedAny |= edge(d); }
  const connected = assign.map(d => (d === 'none' ? false : d.startsWith('kb') ? true : (extra.connected?.[d] ?? true)));
  return {
    pads: assign.map(d => cur[d]), pressed: assign.map(d => edge(d)), any, pressedAny, key,
    connected, esc: extra.esc ?? false, padButton: extra.padButton ?? null,
  };
}

export function idleInput(): MenuInput {
  return {
    pads: [0, 0, 0, 0, 0], pressed: [0, 0, 0, 0, 0], any: 0, pressedAny: 0, key: null,
    connected: [true, true, true, true, true], esc: false, padButton: null,
  };
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
  private padmaps: PadMap[] = [];
  private padHeld: boolean[][] = [];   // [pad][button] segurado na última leitura
  private lastPad: { pad: number; button: number } | null = null;

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

  setPadmaps(maps: readonly PadMap[]): void {
    this.padmaps = maps.map(m => ({ ...m }));
  }

  poll(): DeviceState {
    const gps = this.gamepads();
    this.trackPadButtons(gps);
    return readDevices(this.down, this.maps, gps, this.padmaps);
  }

  private trackPadButtons(gps: readonly (GamepadLike | null)[]): void {
    for (let p = 0; p < gps.length; p++) {
      const gp = gps[p];
      const prev = this.padHeld[p] ?? [];
      const held: boolean[] = [];
      for (let btn = 0; btn < 32; btn++) {
        const pressed = !!gp?.buttons[btn]?.pressed;
        held[btn] = pressed;
        if (pressed && !prev[btn] && !this.lastPad) this.lastPad = { pad: p, button: btn };
      }
      this.padHeld[p] = held;
    }
  }

  /** 1º botão bruto de gamepad que passou de solto para apertado desde a última chamada (remapeamento). */
  takePadButton(): { pad: number; button: number } | null {
    const p = this.lastPad;
    this.lastPad = null;
    return p;
  }

  /** Dispositivo está conectado: teclados sempre; gamepad conforme a API; 'none' nunca. */
  connected(): Record<DeviceId, boolean> {
    const gps = this.gamepads();
    const gp = (i: number) => { const g = gps[i]; return !!g && g.connected !== false; };
    return { kb0: true, kb1: true, gp0: gp(0), gp1: gp(1), gp2: gp(2), gp3: gp(3), none: false };
  }

  /** Esc está segurado neste instante. */
  escHeld(): boolean {
    return this.down.has('Escape');
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
