import { BTN } from '../game/core-api';

export interface KeyMap {
  up: string; down: string; left: string; right: string; a: string; b: string; x: string; y: string;
  l: string; r: string; start: string; select: string;
  power: string;   // tecla própria do P (extra); '' = sem tecla, o Y faz P e soco como na ROM
}

export const KEY_FIELDS: readonly (keyof KeyMap)[] = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select', 'power'];

/** Spec §11/R16: P1 = WASD + J/K/L/I + Enter + Q/E/F; P2 = setas + Numpad1/2/3/5 + NumpadEnter + 7/9/0.
 *  P3–P5 começam sem teclas (''): quem passar para o teclado configura as suas. */
const NO_KEYS: KeyMap = { up: '', down: '', left: '', right: '', a: '', b: '', x: '', y: '', l: '', r: '', start: '', select: '', power: '' };
export const DEFAULT_KEYMAPS: readonly KeyMap[] = [
  {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyJ', b: 'KeyK', y: 'KeyL', x: 'KeyI',
    start: 'Enter', l: 'KeyQ', r: 'KeyE', select: 'KeyF', power: '',
  },
  {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Numpad1', b: 'Numpad2',
    y: 'Numpad3', x: 'Numpad5', start: 'NumpadEnter', l: 'Numpad7', r: 'Numpad9', select: 'Numpad0', power: '',
  },
  NO_KEYS, NO_KEYS, NO_KEYS,
];

/** Dispositivo de um jogador: o teclado (com as teclas daquele jogador), um dos 4 controles ou nenhum. */
export type DeviceId = 'kb' | 'gp0' | 'gp1' | 'gp2' | 'gp3' | 'none';
export const DEVICE_IDS: readonly DeviceId[] = ['kb', 'gp0', 'gp1', 'gp2', 'gp3', 'none'];
/** Botões segurados por jogador (0–4); o índice 5 junta o que não é de ninguém (controles sem dono, teclas de quem
 *  não está no teclado), que só serve para navegar os menus. */
export type DeviceState = number[];

export function emptyDevices(): DeviceState {
  return [0, 0, 0, 0, 0, 0];
}

const FIELD_BTN: Record<keyof KeyMap, number> = {
  up: BTN.UP, down: BTN.DOWN, left: BTN.LEFT, right: BTN.RIGHT, a: BTN.A, b: BTN.B, x: BTN.X, y: BTN.Y,
  l: BTN.L, r: BTN.R, start: BTN.START, select: BTN.SELECT, power: BTN.POWER,
};

export function readKeyMap(down: ReadonlySet<string>, m: KeyMap): number {
  let v = 0;
  for (const f of KEY_FIELDS) if (m[f] && down.has(m[f])) v |= FIELD_BTN[f];
  return v;
}

export interface GamepadLike { buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number>; connected?: boolean }

/** Mapa dos 12 botões lógicos para os índices de botão do layout "standard" da Gamepad API (remapeável). */
export interface PadMap {
  up: number; down: number; left: number; right: number; a: number; b: number; x: number; y: number;
  l: number; r: number; start: number; select: number;
  power: number;   // -1 = sem botão
}

export const PAD_FIELDS: readonly (keyof PadMap)[] = KEY_FIELDS;

/** Layout "standard" da Gamepad API: A = 1, B = 0, Y = 2, X = 3, L = 4, R = 5, SELECT = 8, START = 9, d-pad 12–15. */
export const DEFAULT_PADMAP: PadMap = {
  a: 1, b: 0, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15, power: -1,
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
  if (map.power >= 0 && b(map.power)) v |= BTN.POWER;
  return v;
}

/** Nomes dos botões do layout "standard" (posições de um controle de Xbox), para a tela de controles. */
export const PAD_NAMES: readonly string[] = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'CIMA', 'BAIXO', 'ESQUERDA', 'DIREITA', 'HOME',
];

/** Nome legível de um índice de botão bruto (Gamepad API) para a tela de controles. */
export function padLabel(i: number): string {
  if (i < 0) return '---';
  return PAD_NAMES[i] ?? `BOTÃO ${i}`;
}

/** O jogador configurou a tecla própria do P no dispositivo que usa? (sem ela, o Y faz P e soco, como na ROM) */
export function hasPowerKey(d: DeviceId, k: KeyMap | undefined, p: PadMap | undefined): boolean {
  if (d === 'none') return false;
  return d === 'kb' ? !!k?.power : (p?.power ?? -1) >= 0;
}

export function readDevices(
  down: ReadonlySet<string>, assign: readonly DeviceId[], keymaps: readonly KeyMap[], gps: readonly (GamepadLike | null)[],
  padmaps: readonly PadMap[] = [],
): DeviceState {
  const out = [0, 1, 2, 3, 4].map(i => {
    const d = assign[i] ?? 'none';
    if (d === 'none') return 0;
    if (d === 'kb') return keymaps[i] ? readKeyMap(down, keymaps[i]) : 0;
    return readGamepad(gps[Number(d[2])] ?? null, padmaps[i] ?? DEFAULT_PADMAP);
  });
  // Teclas de quem não está no teclado continuam navegando os menus (senão, passar o P1 para "nenhum" deixaria
  // WASD/J mortos até nas Opções). As teclas não se repetem entre jogadores (`assignKey`), então não há conflito.
  let free = 0;
  keymaps.forEach((m, i) => { if ((assign[i] ?? 'none') !== 'kb') free |= readKeyMap(down, m); });
  gps.forEach((gp, n) => { if (!assign.includes(`gp${n}` as DeviceId)) free |= readGamepad(gp); });
  return [...out, free];
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
  const edges = cur.map((v, i) => v & ~(prev[i] ?? 0));
  const any = cur.reduce((a, v) => a | v, 0), pressedAny = edges.reduce((a, v) => a | v, 0);
  const connected = assign.map(d => (d === 'none' ? false : d === 'kb' ? true : (extra.connected?.[d] ?? true)));
  return {
    pads: cur.slice(0, 5), pressed: edges.slice(0, 5), any, pressedAny, key,
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

/** Nomes em PT-BR das teclas (KeyboardEvent.code) sem letra/dígito próprio. Só usa caracteres da fonte `ascii8`
 *  (A–Z, 0–9, pontuação e Ã Ç Ê Ó Õ Ú): símbolos aparecem como o próprio símbolo. */
export const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: 'SETA CIMA', ArrowDown: 'SETA BAIXO', ArrowLeft: 'SETA ESQ', ArrowRight: 'SETA DIR',
  Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Space: 'ESPAÇO', Tab: 'TAB', Backspace: 'APAGAR', Delete: 'DELETE',
  Insert: 'INSERT', Home: 'HOME', End: 'END', PageUp: 'PAGE UP', PageDown: 'PAGE DOWN', Escape: 'ESC',
  ShiftLeft: 'SHIFT ESQ', ShiftRight: 'SHIFT DIR', ControlLeft: 'CTRL ESQ', ControlRight: 'CTRL DIR',
  AltLeft: 'ALT ESQ', AltRight: 'ALT GR', MetaLeft: 'WIN ESQ', MetaRight: 'WIN DIR', CapsLock: 'CAPS LOCK',
  ContextMenu: 'MENU', NumLock: 'NUM LOCK', ScrollLock: 'SCROLL LOCK', Pause: 'PAUSE', PrintScreen: 'PRINT SCREEN',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: 'CRASE',
  Comma: ',', Period: '.', Slash: '/', Backslash: 'BARRA INVERTIDA', IntlBackslash: 'BARRA INVERTIDA 2', IntlRo: '/ (ABNT)',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
  NumpadComma: 'NUM ,', NumpadEqual: 'NUM =',
};

/** Nome legível de uma tecla (KeyboardEvent.code) para a tela de remapeamento, sempre em PT-BR (M3: antes caía no
 *  código em inglês, ex.: "BRACKETLEFT"). Tecla sem nome conhecido: "OUTRA TECLA". */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `NUM ${code.slice(6)}`;
  if (/^F[0-9]{1,2}$/.test(code)) return code;
  if (!code) return '---';
  return KEY_NAMES[code] ?? 'OUTRA TECLA';
}

/** Teclas que não viram teclas do jogo (M3): Esc cancela a captura; F1–F24, Tab, Windows/Meta, menu de contexto e
 *  PrintScreen são do navegador/sistema (o jogo daria `preventDefault` nelas). */
export function isReservedKey(code: string): boolean {
  return code === 'Escape' || code === 'Tab' || /^F[0-9]{1,2}$/.test(code) || /^(Meta|OS)(Left|Right)$/.test(code)
    || code === 'ContextMenu' || code === 'PrintScreen';
}

/** Grava `code` na ação `f` das teclas do jogador `idx`. Se a tecla já estava em outra ação (deste jogador ou de outro),
 *  as duas trocam: a outra ação fica com a tecla antiga de `f` (M3: nenhuma tecla em duas ações ao mesmo tempo). */
export function assignKey(maps: KeyMap[], idx: number, f: keyof KeyMap, code: string): void {
  const old = maps[idx][f];
  if (code) maps.forEach((m, k) => { for (const g of KEY_FIELDS) if (m[g] === code && !(k === idx && g === f)) m[g] = old; });
  maps[idx][f] = code;
}

/** Mesmo que `assignKey` para os botões de um controle (o mesmo botão não fica em duas ações do mesmo controle). */
export function assignPadButton(map: PadMap, f: keyof PadMap, button: number): void {
  const old = map[f];
  for (const g of PAD_FIELDS) if (map[g] === button && g !== f) map[g] = old;
  map[f] = button;
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
  private extra: KeyMap | null = null;
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
    this.refreshGameKeys();
  }

  /** Teclas de um perfil avulso (controle da sala online): também não rolam a página. */
  setExtraKeymap(m: KeyMap | null): void {
    this.extra = m ? { ...m } : null;
    this.refreshGameKeys();
  }

  private refreshGameKeys(): void {
    this.gameKeys = new Set([...this.maps, ...(this.extra ? [this.extra] : [])].flatMap(m => Object.values(m)).filter(Boolean));
  }

  /** Botões de um perfil avulso (controle da sala online), fora da atribuição dos 5 jogadores locais. */
  readProfile(device: DeviceId, keymap: KeyMap, padmap: PadMap): number {
    if (device === 'none') return 0;
    if (device === 'kb') return readKeyMap(this.down, keymap);
    return readGamepad(this.gamepads()[Number(device[2])] ?? null, padmap);
  }

  setPadmaps(maps: readonly PadMap[]): void {
    this.padmaps = maps.map(m => ({ ...m }));
  }

  poll(assign: readonly DeviceId[]): DeviceState {
    const gps = this.gamepads();
    this.trackPadButtons(gps);
    return readDevices(this.down, assign, this.maps, gps, this.padmaps);
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
    return { kb: true, gp0: gp(0), gp1: gp(1), gp2: gp(2), gp3: gp(3), none: false };
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
