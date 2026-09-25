# Crown Blast: Plano 3, Menus e configurações

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a partida pela URL pelo fluxo completo de menus do original (spec §10). Também resolver as pendências de arquitetura do Plano 2: atribuição de controle por jogador (5 jogadores no Chrome), roteador de telas, configurações salvas, humanos vs CPU, fim de partida sinalizado e remapeamento de teclas.

**Architecture:** A entrada passa a ser por dispositivo. Existem `kb0`/`kb1` (os dois conjuntos de teclado) e `gp0`–`gp3` (controles), e cada jogador tem um dispositivo atribuído. Os menus aceitam qualquer dispositivo. Um `App` simples guarda a tela atual e as `Settings`: nomes, dispositivos, teclas e a formação da última partida, salvas em `localStorage` e validadas ao carregar. Cada tela é um objeto `{ id, update(input), draw(ctx, bank, frame), frozen? }` criado por uma função `xxxScreen(app)`, e troca de tela com `app.go()`. A sessão de jogo passa a respeitar humanos vs CPU, termina (`finished`) em vez de recomeçar, permite sair pela pausa e emite avisos (`notices`) para o áudio e o webhook do Plano 4.

**Tech Stack:** TypeScript 5, Vite, Vitest, Canvas 2D, Gamepad API, `playwright-core` (screenshots).

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-web-design.md` (§10, §11)

## Global Constraints

- **Não modificar `web/src/core/`.** O cliente importa apenas de `../core`.
- **Código validado:** todo o código deste plano já foi escrito, testado (176 testes, `tsc` limpo, `vite build` ok) e conferido visualmente pelo controlador. Os blocos devem ser copiados **exatamente**. Onde o passo diz "substituir o arquivo inteiro", troque o conteúdo todo.
- Textos em PT-BR, maiúsculos na tela; nada da Hudson/Konami.
- Teclas padrão: Teclado 1 = WASD + J(A) K(B) L(Y) Enter(START); Teclado 2 = setas + Numpad1/2/3 + NumpadEnter. Atribuição padrão: P1 Teclado 1, P2 Teclado 2, P3–P5 Controles 1–3. Formação padrão: P1–P2 humanos, P3–P5 CPU.
- Menus: CIMA/BAIXO movem, ESQ/DIR mudam valor, A ou START confirmam, B volta. Cada tela tem `id` ('title', 'vs', 'mode', 'players', 'rules', 'characters', 'stage', 'battle', 'settings', 'names', 'remap').
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de arquivos

```
web/src/input/input.ts            (substitui) dispositivos, atribuição, MenuInput, InputManager com setKeymaps/dispose/última tecla
web/src/app/settings.ts           (novo) Settings/Setup, padrões, validação, localStorage
web/src/game/config.ts            (substitui) GameConfig com humans/names; configFromSetup; validateSetup; displayName
web/src/game/session.ts           (substitui) humanos vs CPU, finished/aborted, sair pela pausa, notices
web/src/render/view.ts            (edita) roundOverText com nomes
web/src/render/draw-screens.ts    (substitui) nomes no placar/vitória, pausa com "B: SAIR"; na Task 6 perde o drawTitle antigo
web/src/app/app.ts                (novo) roteador de telas
web/src/screens/menu.ts           (novo) lista de menu pura (MenuList, cycle, clamp)
web/src/screens/ui.ts             (novo) desenho de fundo, painel, menu, cursor, rodapé
web/src/screens/title.ts, vs.ts, players.ts, rules.ts, characters.ts, stage.ts, battle.ts, settings-screen.ts   (novos)
web/src/main.ts                   (substitui 3 vezes: T1 e T3 intermediários, T6 final)
web/scripts/snapshots.mjs         (substitui) percorre os menus
web/tests/client/input-loop.test.ts, session.test.ts (substituem); settings.test.ts, menu.test.ts, screens.test.ts (novos)
```

---

### Task 1: Entrada por dispositivo e InputManager completo

**Files:**
- Replace: `web/src/input/input.ts`, `web/tests/client/input-loop.test.ts`, `web/src/main.ts` (versão intermediária)

**Interfaces:**
- Produces: `KeyMap`, `KEY_FIELDS`, `DEFAULT_KEYMAPS`, `type DeviceId = 'kb0'|'kb1'|'gp0'|'gp1'|'gp2'|'gp3'|'none'`, `DEVICE_IDS`, `type DeviceState`, `emptyDevices()`, `readKeyMap(down, map)`, `readGamepad(gp)`, `readDevices(down, maps, gps)`, `interface MenuInput { pads; pressed; any; pressedAny; key }`, `buildInput(cur, prev, assign, key?)`, `idleInput()`, `keyLabel(code)`, `interface KeyTarget`, `class InputManager { constructor(target, maps?, gamepads?); setKeymaps(maps); poll(): DeviceState; takeLastKey(): string|null; dispose() }`
- Removes: `readKeyboard`, `mergePads` (o `InputManager.poll()` agora devolve `DeviceState`)

- [ ] **Step 1: Substituir o teste** `web/tests/client/input-loop.test.ts` por:

```ts
import { readKeyMap, readGamepad, readDevices, buildInput, emptyDevices, keyLabel, InputManager, DEFAULT_KEYMAPS, type GamepadLike } from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/core';

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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/input-loop.test.ts`
Expected: FAIL (`readKeyMap`, `readDevices`, `buildInput` etc. não existem)

- [ ] **Step 3: Substituir** `web/src/input/input.ts` por:

```ts
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
```

- [ ] **Step 4: Substituir** `web/src/main.ts` pela versão intermediária (até a Task 6 ligar os menus):

```ts
import { BTN } from './core';
import { parseConfig } from './game/config';
import { createSession, type Session } from './game/session';
import { InputManager, buildInput, emptyDevices } from './input/input';
import { startLoop } from './app/loop';
import { tickGame } from './app/tick';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { createView } from './render/view';
import { drawSession, drawTitle } from './render/draw-screens';

const cfg = parseConfig(window.location.search);
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();
const input = new InputManager(window);
const view = createView();
let session: Session | null = null;
let prevPads = [0, 0, 0, 0, 0];
let prevDevs = emptyDevices();
let frame = 0;

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __crown: { readonly session: Session | null } }).__crown = { get session() { return session; } };
}

startLoop(() => {
  // Até o Plano 3 ligar os menus: Teclado 1 → P1, Teclado 2 → P2, Controles 1–3 → P3–P5.
  const cur = input.poll();
  const pads = buildInput(cur, prevDevs, ['kb0', 'kb1', 'gp0', 'gp1', 'gp2']).pads;
  prevDevs = cur;
  if (!session) {
    frame++;
    const start = pads.some((p, i) => (p & ~prevPads[i] & (BTN.START | BTN.A)) !== 0);
    prevPads = pads;
    if (start) session = createSession(cfg, cfg.seed ?? (Date.now() >>> 0), pads);
    return;
  }
  tickGame(session, view, pads);
  // Congela a animação (bombas, blocos queimando) durante a pausa; o core já congela sozinho.
  if (!session.paused) frame++;
}, () => {
  if (session) drawSession(ctx, session, view, bank, frame);
  else drawTitle(ctx, bank, frame);
});
```

- [ ] **Step 5: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 137 testes PASS; tsc limpo

- [ ] **Step 6: Commit**

```bash
git add web/src/input/input.ts web/tests/client/input-loop.test.ts web/src/main.ts
git commit -m "feat(client): entrada por dispositivo (2 teclados + 4 controles), atribuição por jogador, remapeável

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Configurações salvas e formação da partida

**Files:**
- Create: `web/src/app/settings.ts`, `web/tests/client/settings.test.ts`
- Replace: `web/src/game/config.ts`

**Interfaces:**
- Consumes: `DEFAULT_KEYMAPS`, `DEVICE_IDS`, `KEY_FIELDS`, `DeviceId`, `KeyMap` (Task 1); `CHARACTERS`; `defaultRules`
- Produces:
  - `type SlotKind = 'human'|'cpu'|'off'`, `RuleChoices`, `Setup { mode; slots; teams; rules; chars; stage }`, `Settings { version: 1; names; devices; keymaps; setup }`
  - `NAME_MAX = 8`, `NAME_CHARS`, `STORAGE_KEY`, `defaultSetup()`, `defaultSettings()`, `sanitizeName()`, `normalizeSettings()`, `StorageLike`, `loadSettings()`, `saveSettings()`, `browserStorage()`
  - `GameConfig` ganha `humans: boolean[]` e `names: string[]`
  - `displayName(names, slot)`, `parseConfig(search)` (agora preenche humans/names), `configFromSetup(setup, names, seed?)`, `validateSetup(mode, slots, teams): string | null`

- [ ] **Step 1: Escrever o teste** `web/tests/client/settings.test.ts`:

```ts
import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, sanitizeName, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { configFromSetup, validateSetup, displayName } from '../../src/game/config';

const memory = (init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('configurações salvas', () => {
  it('padrão: P1 Teclado 1, P2 Teclado 2, P3–P5 Controles 1–3; 2 humanos e 3 CPUs', () => {
    const s = defaultSettings();
    expect(s.devices).toEqual(['kb0', 'kb1', 'gp0', 'gp1', 'gp2']);
    expect(s.setup.slots).toEqual(['human', 'human', 'cpu', 'cpu', 'cpu']);
    expect(s.setup.rules.matches).toBe(3);
    expect(s.keymaps[0].a).toBe('KeyJ');
  });
  it('salva e carrega de volta', () => {
    const st = memory();
    const s = defaultSettings();
    s.names[0] = 'ANA';
    s.devices[4] = 'gp3';
    s.setup.stage = 7;
    saveSettings(st, s);
    expect(loadSettings(st)).toEqual(s);
  });
  it('JSON corrompido ou ausente → padrão', () => {
    expect(loadSettings(memory({ [STORAGE_KEY]: '{oops' }))).toEqual(defaultSettings());
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
  });
  it('campos inválidos caem no padrão, campos válidos são mantidos', () => {
    const s = normalizeSettings({
      names: ['bia', 42], devices: ['gp3', 'xbox'], keymaps: [{ up: 'KeyI', down: '' }],
      setup: { mode: 'team', slots: ['cpu', 'robot'], rules: { matches: 9, timeIdx: 4, racer: 'yes' }, chars: [5, 99], stage: 0 },
    });
    expect(s.names).toEqual(['BIA', '', '', '', '']);
    expect(s.devices.slice(0, 2)).toEqual(['gp3', 'kb1']);
    expect([s.keymaps[0].up, s.keymaps[0].down]).toEqual(['KeyI', 'KeyS']);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.slots.slice(0, 2)).toEqual(['cpu', 'human']);
    expect([s.setup.rules.matches, s.setup.rules.timeIdx, s.setup.rules.racer]).toEqual([3, 4, false]);
    expect(s.setup.chars.slice(0, 2)).toEqual([5, 1]);
    expect(s.setup.stage).toBe(1);
  });
  it('falha ao gravar não derruba o jogo', () => {
    const st: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(() => saveSettings(st, defaultSettings())).not.toThrow();
  });
  it('nomes: maiúsculas, caracteres permitidos, até 8', () => {
    expect(sanitizeName('joão da silva')).toBe('JOAO DA');
    expect(sanitizeName('  zé-1  ')).toBe('ZE-1');
    expect(sanitizeName('😀abc')).toBe('ABC');
    expect(sanitizeName(undefined)).toBe('');
  });
});

describe('da escolha dos menus para a partida', () => {
  it('configFromSetup: ativos, humanos, times, regras e nomes', () => {
    const s = defaultSettings();
    s.setup.mode = 'team';
    s.setup.slots = ['human', 'cpu', 'off', 'human', 'cpu'];
    s.setup.teams = [0, 1, 0, 1, 0];
    s.setup.rules.matches = 5;
    s.setup.stage = 4;
    const cfg = configFromSetup(s.setup, ['ANA', '', '', '', '']);
    expect(cfg.rules.active).toEqual([true, true, false, true, true]);
    expect(cfg.humans).toEqual([true, false, false, true, false]);
    expect([cfg.rules.mode, cfg.rules.matches, cfg.stage]).toEqual(['team', 5, 4]);
    expect(cfg.rules.teams).toEqual([0, 1, 0, 1, 0]);
    expect(cfg.names[0]).toBe('ANA');
  });
  it('validação da formação', () => {
    expect(validateSetup('ffa', ['human', 'off', 'off', 'off', 'off'], [0, 1, 0, 1, 0])).toBe('PRECISA DE 2 JOGADORES');
    expect(validateSetup('ffa', ['human', 'cpu', 'off', 'off', 'off'], [0, 1, 0, 1, 0])).toBeNull();
    expect(validateSetup('team', ['human', 'cpu', 'off', 'off', 'off'], [0, 0, 1, 1, 1])).toBe('CADA TIME PRECISA DE 1 JOGADOR');
    expect(validateSetup('team', ['human', 'cpu', 'off', 'off', 'off'], [0, 1, 1, 1, 1])).toBeNull();
  });
  it('nome de exibição', () => {
    expect(displayName(['ANA', '', ' ', '', ''], 0)).toBe('ANA');
    expect(displayName(['ANA', '', ' ', '', ''], 2)).toBe('P3');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/settings.test.ts`
Expected: FAIL (`src/app/settings` não existe)

- [ ] **Step 3: Criar** `web/src/app/settings.ts`:

```ts
import { defaultRules } from '../core';
import { DEFAULT_KEYMAPS, DEVICE_IDS, KEY_FIELDS, type DeviceId, type KeyMap } from '../input/input';
import { CHARACTERS } from '../render/art/bomber';

export type SlotKind = 'human' | 'cpu' | 'off';

export interface RuleChoices {
  cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number;
  suddenDeath: boolean; badBomber: boolean; racer: boolean; randomSpawns: boolean;
}

/** O que foi escolhido nos menus para a próxima partida (lembrado entre sessões). */
export interface Setup {
  mode: 'ffa' | 'team';
  slots: SlotKind[];
  teams: number[];
  rules: RuleChoices;
  chars: number[];
  stage: number;
}

export interface Settings {
  version: 1;
  names: string[];
  devices: DeviceId[];
  keymaps: KeyMap[];
  setup: Setup;
}

export const NAME_MAX = 8;
export const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
export const STORAGE_KEY = 'crown-blast/settings';

export function defaultSetup(): Setup {
  const r = defaultRules();
  return {
    mode: 'ffa', slots: ['human', 'human', 'cpu', 'cpu', 'cpu'], teams: [0, 1, 0, 1, 0],
    rules: {
      cpuLevel: r.cpuLevel, matches: r.matches, timeIdx: r.timeIdx, suddenDeath: r.suddenDeath,
      badBomber: r.badBomber, racer: r.racer, randomSpawns: r.randomSpawns,
    },
    chars: [0, 1, 2, 3, 4], stage: 1,
  };
}

export function defaultSettings(): Settings {
  return {
    version: 1, names: ['', '', '', '', ''], devices: ['kb0', 'kb1', 'gp0', 'gp1', 'gp2'],
    keymaps: DEFAULT_KEYMAPS.map(m => ({ ...m })), setup: defaultSetup(),
  };
}

/** Maiúsculas sem acento, só A–Z, 0–9, espaço e hífen, no máximo NAME_MAX caracteres. */
export function sanitizeName(s: unknown): string {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()) if (NAME_CHARS.includes(ch)) out += ch;
  return out.trim().slice(0, NAME_MAX).trimEnd();
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const oneOf = <T>(v: unknown, allowed: readonly T[], def: T): T => ((allowed as readonly unknown[]).includes(v) ? (v as T) : def);
const intIn = (v: unknown, min: number, max: number, def: number): number =>
  (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : def);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const five = <T>(v: unknown, f: (x: unknown, i: number) => T): T[] => [0, 1, 2, 3, 4].map(i => f(Array.isArray(v) ? v[i] : undefined, i));

function normalizeKeyMap(v: unknown, def: KeyMap): KeyMap {
  const o = asObj(v);
  const m = { ...def };
  for (const f of KEY_FIELDS) {
    const k = o[f];
    if (typeof k === 'string' && k.length > 0 && k.length < 32) m[f] = k;
  }
  return m;
}

/** Aceita qualquer coisa (JSON antigo, corrompido, parcial) e devolve configurações válidas. */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = asObj(raw);
  const s = asObj(r.setup);
  const rr = asObj(s.rules);
  const ds = d.setup;
  return {
    version: 1,
    names: five(r.names, x => sanitizeName(x)),
    devices: five(r.devices, (x, i) => oneOf(x, DEVICE_IDS, d.devices[i])),
    keymaps: [0, 1].map(k => normalizeKeyMap(Array.isArray(r.keymaps) ? r.keymaps[k] : undefined, d.keymaps[k])),
    setup: {
      mode: oneOf(s.mode, ['ffa', 'team'] as const, ds.mode),
      slots: five(s.slots, (x, i) => oneOf(x, ['human', 'cpu', 'off'] as const, ds.slots[i])),
      teams: five(s.teams, (x, i) => oneOf(x, [0, 1] as const, ds.teams[i])),
      rules: {
        cpuLevel: oneOf(rr.cpuLevel, [0, 1, 2] as const, ds.rules.cpuLevel),
        matches: intIn(rr.matches, 1, 5, ds.rules.matches),
        timeIdx: intIn(rr.timeIdx, 0, 4, ds.rules.timeIdx),
        suddenDeath: bool(rr.suddenDeath, ds.rules.suddenDeath),
        badBomber: bool(rr.badBomber, ds.rules.badBomber),
        racer: bool(rr.racer, ds.rules.racer),
        randomSpawns: bool(rr.randomSpawns, ds.rules.randomSpawns),
      },
      chars: five(s.chars, (x, i) => intIn(x, 0, CHARACTERS.length - 1, ds.chars[i])),
      stage: intIn(s.stage, 1, 10, ds.stage),
    },
  };
}

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function loadSettings(st: StorageLike | null): Settings {
  try {
    const raw = st?.getItem(STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(st: StorageLike | null, s: Settings): void {
  try {
    st?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // armazenamento indisponível (aba anônima, cota): segue só em memória
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Substituir** `web/src/game/config.ts` por:

```ts
import { defaultRules, type Rules } from '../core';
import { CHARACTERS } from '../render/art/bomber';
import type { Setup, SlotKind } from '../app/settings';

export interface GameConfig {
  rules: Rules; stage: number; chars: number[]; seed: number | null;
  humans: boolean[];   // slots controlados por gente (CPU = false)
  names: string[];     // nomes dos jogadores ('' = usar P1..P5)
}

function int(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Nome para exibir: o nome configurado ou P1..P5. */
export function displayName(names: readonly string[], slot: number): string {
  const n = names[slot]?.trim();
  return n ? n : `P${slot + 1}`;
}

/**
 * Partida rápida pela URL (usada com ?quick e pelas screenshots):
 * ?stage=1..10&players=2..5&matches=1..5&time=0..4&mode=ffa|team&sd=1&racer=1&spawns=0&chars=0,1,2,3,4&seed=N
 * Todos os jogadores ativos são humanos.
 */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const active = [0, 1, 2, 3, 4].map(i => i < players);
  const rules: Rules = {
    ...defaultRules(),
    matches: int(q.get('matches'), 3, 1, 5),
    timeIdx: int(q.get('time'), 2, 0, 4),
    suddenDeath: q.get('sd') === '1',
    racer: q.get('racer') === '1',
    randomSpawns: q.get('spawns') !== '0',
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    teams: [0, 1, 0, 1, 0],
    active,
  };
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const chars = [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] < CHARACTERS.length ? raw[i] : i));
  return {
    rules, stage: int(q.get('stage'), 1, 1, 10), chars,
    seed: q.has('seed') ? int(q.get('seed'), 0, 0, 2 ** 31 - 1) : null,
    humans: [...active], names: ['', '', '', '', ''],
  };
}

/** Regras da partida a partir das escolhas dos menus. */
export function configFromSetup(setup: Setup, names: readonly string[], seed: number | null = null): GameConfig {
  const rules: Rules = {
    ...defaultRules(), ...setup.rules,
    mode: setup.mode, teams: [...setup.teams], active: setup.slots.map(k => k !== 'off'),
  };
  return {
    rules, stage: setup.stage, chars: [...setup.chars], seed,
    humans: setup.slots.map(k => k === 'human'), names: [...names],
  };
}

/** Mensagem de erro se a formação não permite jogar; null se está tudo certo. */
export function validateSetup(mode: 'ffa' | 'team', slots: readonly SlotKind[], teams: readonly number[]): string | null {
  const on = [0, 1, 2, 3, 4].filter(i => slots[i] !== 'off');
  if (on.length < 2) return 'PRECISA DE 2 JOGADORES';
  if (mode === 'team' && new Set(on.map(i => teams[i])).size < 2) return 'CADA TIME PRECISA DE 1 JOGADOR';
  return null;
}
```

- [ ] **Step 5: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 146 testes PASS; tsc limpo

- [ ] **Step 6: Commit**

```bash
git add web/src/app/settings.ts web/src/game/config.ts web/tests/client/settings.test.ts
git commit -m "feat(client): configurações salvas (nomes, controles, teclas, formação) e config da partida a partir dos menus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sessão com humanos/CPU, fim de partida, saída pela pausa e avisos

**Files:**
- Replace: `web/src/game/session.ts`, `web/src/render/draw-screens.ts` (versão desta task), `web/tests/client/session.test.ts`, `web/src/main.ts` (intermediária)
- Modify: `web/src/render/view.ts` (só `roundOverText` e um import)

**Interfaces:**
- Consumes: `GameConfig.humans`, `GameConfig.names`, `displayName` (Task 2)
- Produces:
  - `Session` sem `matchNo`; ganha `finished: boolean`, `aborted: boolean`, `notices: SessionNotice[]`
  - `type SessionNotice = { type: 'round_over'; winners; crowns } | { type: 'match_over'; champions; crowns }`
  - Comportamentos novos: só humanos pausam, pulam telas e controlam personagem (CPUs recebem 0); na pausa, B encerra (`finished` + `aborted`); na vitória, START/A encerra (`finished`) sem recomeçar
  - `roundOverText(winners, mode, teams, names = [])`

- [ ] **Step 1: Substituir o teste** `web/tests/client/session.test.ts` por:

```ts
import { parseConfig } from '../../src/game/config';
import { createSession, updateSession, ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER, type Session } from '../../src/game/session';
import { BTN, INTRO_FRAMES } from '../../src/core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_FRAMES + 1);
  s.round.players.forEach((p, i) => { if (i !== winner) p.alive = false; });
  run(s, 1);
};

describe('parseConfig', () => {
  it('padrões', () => {
    const c = parseConfig('');
    expect(c.stage).toBe(1);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect([c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([3, 2, true, 'ffa']);
    expect(c.chars).toEqual([0, 1, 2, 3, 4]);
    expect(c.seed).toBeNull();
  });
  it('lê e limita os parâmetros', () => {
    const c = parseConfig('?stage=12&players=1&matches=9&time=4&chars=5,5,x&seed=42&mode=team&sd=1&racer=1&spawns=0');
    expect(c.stage).toBe(10);
    expect(c.rules.active).toEqual([true, true, false, false, false]);
    expect([c.rules.matches, c.rules.timeIdx]).toEqual([5, 4]);
    expect(c.chars).toEqual([5, 5, 2, 3, 4]);
    expect(c.seed).toBe(42);
    expect([c.rules.mode, c.rules.suddenDeath, c.rules.racer, c.rules.randomSpawns]).toEqual(['team', true, true, false]);
  });
});

describe('sessão', () => {
  it('começa em batalha com a rodada em intro', () => {
    const s = createSession(parseConfig(''), 1);
    expect(s.phase).toBe('battle');
    expect(s.round.phase).toBe('intro');
    run(s, INTRO_FRAMES + 1);
    expect(s.round.phase).toBe('playing');
  });
  it('fim de rodada → placar com coroa → próxima rodada', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.match.crowns[1]).toBe(1);
    expect(s.lastWinners).toEqual([1]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('battle');
    expect(s.match.roundNo).toBe(2);
  });
  it('placar só pode ser pulado depois de SKIP_AFTER frames', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES);
    run(s, 30); tap(s, 0, BTN.START);
    expect(s.phase).toBe('scoreboard');
    run(s, SKIP_AFTER); tap(s, 0, BTN.START);
    expect(s.phase).toBe('battle');
  });
  it('meta atingida → vitória → START encerra a partida (a tela que hospeda decide o que vem depois)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES); run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    expect(s.champions).toEqual([0]);
    tap(s, 0, BTN.START);
    expect(s.finished).toBe(false);
    run(s, SKIP_AFTER); tap(s, 1, BTN.A);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(false);
  });
  it('avisos de fim de rodada e de fim de partida (para áudio e webhook)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 1); run(s, ROUND_OVER_FRAMES);
    expect(s.notices).toEqual([
      { type: 'round_over', winners: [1], crowns: [0, 1, 0, 0, 0] },
      { type: 'match_over', champions: [1], crowns: [0, 1, 0, 0, 0] },
    ]);
  });
  it('na pausa, B sai da partida', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 5);
    tap(s, 0, BTN.B);
    expect(s.finished).toBe(false);
    tap(s, 0, BTN.START);
    tap(s, 1, BTN.B);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(true);
  });
  it('slots de CPU não pausam nem controlam o personagem', () => {
    const cfg = parseConfig('?players=3');
    cfg.humans = [true, true, false, false, false];
    const s = createSession(cfg, 1);
    run(s, INTRO_FRAMES + 1);
    tap(s, 2, BTN.START);
    expect(s.paused).toBe(false);
    const x = s.round.players[2].x, y = s.round.players[2].y;
    const p = [0, 0, BTN.A | BTN.DOWN | BTN.RIGHT, 0, 0];
    for (let i = 0; i < 20; i++) updateSession(s, p);
    expect([s.round.players[2].x, s.round.players[2].y]).toEqual([x, y]);
    expect(s.round.bombs.filter(b => b.owner === 2)).toHaveLength(0);
  });
  it('START pausa e retoma; slot inativo não pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 10);
    tap(s, 4, BTN.START);
    expect(s.paused).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    const f = s.round.frame;
    run(s, 20);
    expect(s.round.frame).toBe(f);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(false);
  });
  it('START já pressionado ao abrir a partida (initialPads) não pausa no primeiro tick', () => {
    const pads = [BTN.START, 0, 0, 0, 0];
    const s = createSession(parseConfig('?players=2'), 1, pads);
    expect(s.prevPads).toEqual(pads);
    updateSession(s, pads);
    expect(s.paused).toBe(false);
  });
  it('modo time: time 0 vence → campeões são todos os slots do time 0', () => {
    const s = createSession(parseConfig('?players=5&mode=team&matches=1'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.players.forEach(p => { if (p.team !== 0) p.alive = false; });
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.champions).toEqual([0, 2, 4]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
  });
  it('empate por tempo esgotado: sem vencedor, sem coroa, ainda vai a placar', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.lastWinners).toEqual([]);
    expect(s.match.crowns).toEqual([0, 0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/session.test.ts`
Expected: FAIL (`finished`, `notices`, máscara de humanos etc.)

- [ ] **Step 3: Substituir** `web/src/game/session.ts` por:

```ts
import { BTN, createMatch, startRound, finishRound, step, type GameEvent, type MatchState, type RoundState } from '../core';
import type { GameConfig } from './config';

export const ROUND_OVER_FRAMES = 150;
export const SCOREBOARD_FRAMES = 540;   // ≈9 s, como o placar do original
export const SKIP_AFTER = 60;

export type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory';

/** Transições que interessam a quem está de fora (áudio, webhook). A fila é consumida por quem lê. */
export type SessionNotice =
  | { type: 'round_over'; winners: number[]; crowns: number[] }
  | { type: 'match_over'; champions: number[]; crowns: number[] };

export interface Session {
  cfg: GameConfig; seed: number;
  match: MatchState; round: RoundState;
  phase: SessionPhase; timer: number; paused: boolean; matchOver: boolean;
  /** true só nos ticks em que `step()` do core de fato rodou (ver web/src/app/tick.ts). */
  stepped: boolean;
  /** A partida acabou (vitória confirmada) ou foi abandonada pela pausa; quem hospeda a sessão troca de tela. */
  finished: boolean;
  aborted: boolean;
  notices: SessionNotice[];
  prevPads: number[]; lastWinners: number[]; champions: number[];
}

export function createSession(cfg: GameConfig, seed: number, initialPads: number[] = [0, 0, 0, 0, 0]): Session {
  const match = createMatch(cfg.rules, cfg.stage, seed);
  return {
    cfg, seed, match, round: startRound(match), phase: 'battle', timer: 0, paused: false, matchOver: false,
    stepped: false, finished: false, aborted: false, notices: [],
    prevPads: [...initialPads], lastWinners: [], champions: [],
  };
}

/** Avança um tick (1/60 s). Devolve os eventos do core deste tick (vazio fora da batalha). */
export function updateSession(s: Session, pads: number[]): GameEvent[] {
  const pressed = pads.map((p, i) => p & ~(s.prevPads[i] ?? 0));
  s.prevPads = [...pads];
  s.stepped = false;
  if (s.finished) return [];
  // Só jogadores humanos pausam, pulam telas ou controlam personagens; CPUs (Plano 4) ficam paradas.
  const hit = (mask: number) => pressed.some((p, i) => s.cfg.humans[i] && (p & mask) !== 0);
  let ev: GameEvent[] = [];
  switch (s.phase) {
    case 'battle':
      if (hit(BTN.START)) s.paused = !s.paused;
      else if (s.paused && hit(BTN.B)) { s.finished = true; s.aborted = true; break; }
      if (s.paused) break;
      ev = step(s.round, pads.map((p, i) => (s.cfg.humans[i] ? p : 0)));
      s.stepped = true;
      if (s.round.phase === 'result') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }
      break;
    case 'roundOver':
      if (--s.timer <= 0) {
        const r = finishRound(s.match, s.round);
        s.lastWinners = r.winners;
        s.champions = r.champions;
        s.matchOver = r.matchOver;
        s.notices.push({ type: 'round_over', winners: [...r.winners], crowns: [...s.match.crowns] });
        if (r.matchOver) s.notices.push({ type: 'match_over', champions: [...r.champions], crowns: [...s.match.crowns] });
        s.phase = 'scoreboard';
        s.timer = SCOREBOARD_FRAMES;
      }
      break;
    case 'scoreboard':
      s.timer--;
      if (s.timer <= 0 || (SCOREBOARD_FRAMES - s.timer > SKIP_AFTER && hit(BTN.START | BTN.A))) {
        if (s.matchOver) { s.phase = 'victory'; s.timer = 0; }
        else { s.round = startRound(s.match); s.phase = 'battle'; }
      }
      break;
    case 'victory':
      s.timer++;
      if (s.timer > SKIP_AFTER && hit(BTN.START | BTN.A)) s.finished = true;
      break;
  }
  return ev;
}
```

- [ ] **Step 4: Editar `web/src/render/view.ts`**

Acrescente depois da linha `import type { FlamePart } from './art/flames';`:
```ts
import { displayName } from '../game/config';
```
e substitua a função `roundOverText` inteira por:
```ts
export function roundOverText(winners: number[], mode: 'ffa' | 'team', teams: number[], names: readonly string[] = []): string {
  if (winners.length === 0) return 'EMPATE!';
  if (mode === 'team') return teams[winners[0]] === 0 ? 'TIME VERMELHO VENCEU!' : 'TIME BRANCO VENCEU!';
  return `${displayName(names, winners[0])} VENCEU!`;
}
```

- [ ] **Step 5: Substituir** `web/src/render/draw-screens.ts` por (nomes no placar e na vitória, pausa com "B: SAIR", placar com espaço para nomes de 8 letras; o `drawTitle` antigo continua até a Task 6):

```ts
import type { Session } from '../game/session';
import { SCOREBOARD_FRAMES, SKIP_AFTER } from '../game/session';
import type { SpriteBank } from './sprite-bank';
import { roundOverText, type ViewState } from './view';
import { displayName } from '../game/config';
import { drawRound, drawTextCentered, SCREEN_W, SCREEN_H } from './draw-game';

export function drawTitle(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void {
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? '#141a3a' : '#18204a';
    ctx.fillRect(0, i * 16, SCREEN_W, 16);
  }
  ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 40, 36, 24);
  drawTextCentered(ctx, bank, 'CROWN BLAST', '#ffd23f', 76, 3);
  if (((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#ffffff', 150, 1);
  drawTextCentered(ctx, bank, 'ENTER / START NO CONTROLE', '#6ad0ff', 170, 1);
}

function drawScoreboard(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank): void {
  ctx.fillStyle = '#12305a';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#0b1f3d';
  ctx.fillRect(12, 34, SCREEN_W - 24, 168);
  drawTextCentered(ctx, bank, 'PLACAR', '#ffd23f', 8, 2);
  const age = SCOREBOARD_FRAMES - s.timer;
  let row = 0;
  s.round.players.forEach((p, i) => {
    if (!p.active) return;
    const y = 40 + row * 32;
    row++;
    ctx.drawImage(bank.head(s.cfg.chars[i]), 18, y + 4);
    ctx.drawImage(bank.text(displayName(s.cfg.names, i), '#ffffff'), 36, y + 6);
    for (let k = 0; k < s.match.rules.matches; k++) {
      const x = 92 + k * 31;
      ctx.fillStyle = '#050b18';
      ctx.fillRect(x, y, 28, 22);
      ctx.fillStyle = '#2a4a7a';
      ctx.fillRect(x + 1, y + 1, 26, 20);
      const won = k < s.match.crowns[i];
      const isNew = won && k === s.match.crowns[i] - 1 && s.lastWinners.includes(i);
      if (won && (!isNew || age > 40 || ((age >> 2) & 1) === 0)) ctx.drawImage(bank.crown(), x + 2, y + 3, 24, 16);
    }
  });
  drawTextCentered(ctx, bank, roundOverText(s.lastWinners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 208, 1);
}

function drawVictory(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank, frame: number): void {
  ctx.fillStyle = '#1d1030';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 3 ? '#ffd23f' : '#ffffff';
    ctx.fillRect((i * 97 + frame) % SCREEN_W, (i * 53) % SCREEN_H, 1, 1);
  }
  drawTextCentered(ctx, bank, 'VITÓRIA!', '#ffd23f', 14, 3);
  const champs = s.champions;
  const total = champs.length * 56;
  champs.forEach((slot, k) => {
    const x = Math.floor((SCREEN_W - total) / 2) + k * 56 + 4;
    const bounce = Math.abs(Math.round(Math.sin((frame + k * 10) / 8) * 6));
    ctx.drawImage(bank.bomber(s.cfg.chars[slot], 2, 0), x, 64 - bounce, 48, 60);
  });
  ctx.drawImage(bank.trophy(), (SCREEN_W - 48) / 2, 132, 48, 48);
  const rules = s.cfg.rules;
  const who = rules.mode === 'team'
    ? (rules.teams[champs[0]] === 0 ? 'TIME VERMELHO É O CAMPEÃO!' : 'TIME BRANCO É O CAMPEÃO!')
    : `${displayName(s.cfg.names, champs[0])} É O CAMPEÃO!`;
  drawTextCentered(ctx, bank, who, '#ffffff', 188, 1);
  if (s.timer > SKIP_AFTER && ((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#6ad0ff', 206, 1);
}

export function drawSession(ctx: CanvasRenderingContext2D, s: Session, view: ViewState, bank: SpriteBank, frame: number): void {
  switch (s.phase) {
    case 'battle':
    case 'roundOver':
      drawRound(ctx, s.round, view, bank, s.cfg.chars, frame, s.match.crowns);
      if (s.round.phase === 'intro') drawTextCentered(ctx, bank, s.round.introLeft > 30 ? 'PRONTOS?' : 'JÁ!', '#ffd23f', 100, 2);
      if (s.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 24, SCREEN_W, SCREEN_H - 24);
        drawTextCentered(ctx, bank, 'PAUSA', '#ffffff', 96, 2);
        drawTextCentered(ctx, bank, 'START: CONTINUAR   B: SAIR', '#6ad0ff', 124, 1);
      }
      if (s.phase === 'roundOver') {
        drawTextCentered(ctx, bank, roundOverText(s.round.winners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 100, 2);
      }
      break;
    case 'scoreboard':
      drawScoreboard(ctx, s, bank);
      break;
    case 'victory':
      drawVictory(ctx, s, bank, frame);
      break;
  }
}
```

- [ ] **Step 6: Substituir** `web/src/main.ts` pela versão intermediária (partida encerrada volta ao título):

```ts
import { BTN } from './core';
import { parseConfig } from './game/config';
import { createSession, type Session } from './game/session';
import { InputManager, buildInput, emptyDevices } from './input/input';
import { startLoop } from './app/loop';
import { tickGame } from './app/tick';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { createView } from './render/view';
import { drawSession, drawTitle } from './render/draw-screens';

const cfg = parseConfig(window.location.search);
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();
const input = new InputManager(window);
const view = createView();
let session: Session | null = null;
let prevPads = [0, 0, 0, 0, 0];
let prevDevs = emptyDevices();
let frame = 0;

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __crown: { readonly session: Session | null } }).__crown = { get session() { return session; } };
}

startLoop(() => {
  // Até o Plano 3 ligar os menus: Teclado 1 → P1, Teclado 2 → P2, Controles 1–3 → P3–P5.
  const cur = input.poll();
  const pads = buildInput(cur, prevDevs, ['kb0', 'kb1', 'gp0', 'gp1', 'gp2']).pads;
  prevDevs = cur;
  if (!session) {
    frame++;
    const start = pads.some((p, i) => (p & ~prevPads[i] & (BTN.START | BTN.A)) !== 0);
    prevPads = pads;
    if (start) session = createSession(cfg, cfg.seed ?? (Date.now() >>> 0), pads);
    return;
  }
  tickGame(session, view, pads);
  // Partida encerrada (vitória confirmada ou saída pela pausa): volta ao título até os menus existirem.
  if (session.finished) { session = null; return; }
  // Congela a animação (bombas, blocos queimando) durante a pausa; o core já congela sozinho.
  if (!session.paused) frame++;
}, () => {
  if (session) drawSession(ctx, session, view, bank, frame);
  else drawTitle(ctx, bank, frame);
});
```

- [ ] **Step 7: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 149 testes PASS; tsc limpo

- [ ] **Step 8: Commit**

```bash
git add web/src/game/session.ts web/src/render/view.ts web/src/render/draw-screens.ts web/tests/client/session.test.ts web/src/main.ts
git commit -m "feat(client): sessão com humanos/CPU, fim de partida, sair pela pausa e avisos para áudio/webhook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Roteador de telas e kit de menus

**Files:**
- Create: `web/src/app/app.ts`, `web/src/screens/menu.ts`, `web/src/screens/ui.ts`, `web/tests/client/menu.test.ts`

**Interfaces:**
- Consumes: `MenuInput`, `KeyMap` (Task 1); `Settings` (Task 2); `SpriteBank`, `drawTextCentered`, `SCREEN_W`, `SCREEN_H` (Plano 2)
- Produces:
  - `interface Screen { id: string; update(inp: MenuInput): void; draw(ctx, bank, frame): void; frozen?(): boolean }`, `interface AppHooks { save; setKeymaps; seed }`, `class App { frame; screen; settings; go(); save(); applyKeymaps(); seed(); update(inp); draw(ctx, bank) }`
  - `interface MenuItem { label; value?; valueColor?; left?; right?; select?; disabled? }`, `type MenuResult`, `class MenuList { cursor; items; handle(pressed): MenuResult }`, `cycle(arr, cur, d)`, `clamp(v, min, max)`
  - `COLORS`, `PLAYER_COLORS`, `ROW_H = 16`, `MENU_BOTTOM = 202`, `drawBackground`, `drawPanel`, `drawText`, `drawTextRight`, `drawCursor`, `drawTitleBar`, `drawMenu(…, rowH?)`, `menuPanelRect(items, width?, rowH?)`, `drawMenuPage(…, width?, rowH?)`, `drawFooter`

- [ ] **Step 1: Escrever o teste** `web/tests/client/menu.test.ts`:

```ts
import { MenuList, cycle, clamp } from '../../src/screens/menu';
import { App, type Screen } from '../../src/app/app';
import { defaultSettings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';
import { BTN } from '../../src/core';

describe('MenuList', () => {
  const make = () => {
    const log: string[] = [];
    const list = new MenuList([
      { label: 'A', disabled: true },
      { label: 'B', select: () => log.push('B'), left: () => log.push('B<'), right: () => log.push('B>') },
      { label: 'C', disabled: true },
      { label: 'D', select: () => log.push('D') },
    ]);
    return { list, log };
  };
  it('começa no primeiro item ativo e pula desativados com volta', () => {
    const { list } = make();
    expect(list.cursor).toBe(1);
    expect(list.handle(BTN.DOWN)).toBe('moved');
    expect(list.cursor).toBe(3);
    list.handle(BTN.DOWN);
    expect(list.cursor).toBe(1);
    list.handle(BTN.UP);
    expect(list.cursor).toBe(3);
  });
  it('ESQ/DIR mudam valor; A e START selecionam; B volta', () => {
    const { list, log } = make();
    expect(list.handle(BTN.LEFT)).toBe('changed');
    expect(list.handle(BTN.RIGHT)).toBe('changed');
    expect(list.handle(BTN.A)).toBe('selected');
    list.handle(BTN.DOWN);
    expect(list.handle(BTN.START)).toBe('selected');
    expect(log).toEqual(['B<', 'B>', 'B', 'D']);
    expect(list.handle(BTN.B)).toBe('back');
    expect(list.handle(0)).toBeNull();
  });
  it('cycle e clamp', () => {
    expect(cycle(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycle(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(cycle(['a', 'b', 'c'], 'x', 1)).toBe('b');
    expect([clamp(9, 1, 5), clamp(0, 1, 5), clamp(3, 1, 5)]).toEqual([5, 1, 3]);
  });
});

describe('App', () => {
  const hooks = () => {
    const calls = { save: 0, keymaps: 0 };
    return { calls, h: { save: () => { calls.save++; }, setKeymaps: () => { calls.keymaps++; }, seed: () => 42 } };
  };
  it('encaminha update/draw para a tela atual e troca com go()', () => {
    const { h } = hooks();
    const app = new App(defaultSettings(), h);
    const seen: string[] = [];
    const b: Screen = { id: 'b', update: () => seen.push('b'), draw: () => {} };
    const a: Screen = { id: 'a', update: () => { seen.push('a'); app.go(b); }, draw: () => {} };
    app.go(a);
    app.update(idleInput());
    app.update(idleInput());
    expect(seen).toEqual(['a', 'b']);
    expect(app.screen.id).toBe('b');
  });
  it('contador de animação para quando a tela está congelada', () => {
    const { h } = hooks();
    const app = new App(defaultSettings(), h);
    let frozen = false;
    app.go({ id: 'x', update() {}, draw() {}, frozen: () => frozen });
    app.update(idleInput());
    frozen = true;
    app.update(idleInput());
    expect(app.frame).toBe(1);
  });
  it('save, applyKeymaps e seed usam os ganchos', () => {
    const { h, calls } = hooks();
    const app = new App(defaultSettings(), h);
    app.save(); app.applyKeymaps();
    expect(calls).toEqual({ save: 1, keymaps: 1 });
    expect(app.seed()).toBe(42);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/menu.test.ts`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Criar** `web/src/app/app.ts`:

```ts
import type { KeyMap, MenuInput } from '../input/input';
import type { SpriteBank } from '../render/sprite-bank';
import type { Settings } from './settings';

/** Uma tela do jogo (menu, batalha…). `frozen` pausa o contador de animação global. */
export interface Screen {
  /** Identificador da tela (testes e depuração). */
  id: string;
  update(inp: MenuInput): void;
  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
  frozen?(): boolean;
}

export interface AppHooks {
  save(s: Settings): void;
  setKeymaps(maps: readonly KeyMap[]): void;
  seed(): number;
}

/** Roteador de telas + configurações compartilhadas. As telas recebem o App e chamam `go()` para trocar. */
export class App {
  frame = 0;
  screen: Screen = { id: 'none', update() {}, draw() {} };

  constructor(public settings: Settings, private hooks: AppHooks) {}

  go(next: Screen): void { this.screen = next; }
  save(): void { this.hooks.save(this.settings); }
  applyKeymaps(): void { this.hooks.setKeymaps(this.settings.keymaps); }
  seed(): number { return this.hooks.seed(); }

  update(inp: MenuInput): void {
    this.screen.update(inp);
    if (!this.screen.frozen?.()) this.frame++;
  }

  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    this.screen.draw(ctx, bank, this.frame);
  }
}
```

- [ ] **Step 4: Criar** `web/src/screens/menu.ts`:

```ts
import { BTN } from '../core';

export interface MenuItem {
  label: string;
  value?: () => string;
  valueColor?: () => string;
  left?: () => void;
  right?: () => void;
  select?: () => void;
  disabled?: boolean;
}

export type MenuResult = 'back' | 'selected' | 'changed' | 'moved' | null;

/** Lista vertical navegável: CIMA/BAIXO movem (pulando itens desativados), ESQ/DIR mudam valor, A/START seleciona, B volta. */
export class MenuList {
  cursor = 0;

  constructor(public items: MenuItem[]) {
    this.cursor = Math.max(0, items.findIndex(i => !i.disabled));
  }

  handle(pressed: number): MenuResult {
    if (pressed & BTN.UP) { this.move(-1); return 'moved'; }
    if (pressed & BTN.DOWN) { this.move(1); return 'moved'; }
    const it = this.items[this.cursor];
    if ((pressed & BTN.LEFT) && it.left && !it.disabled) { it.left(); return 'changed'; }
    if ((pressed & BTN.RIGHT) && it.right && !it.disabled) { it.right(); return 'changed'; }
    if ((pressed & (BTN.A | BTN.START)) && it.select && !it.disabled) { it.select(); return 'selected'; }
    if (pressed & BTN.B) return 'back';
    return null;
  }

  private move(d: number): void {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (((this.cursor + d * k) % n) + n) % n;
      if (!this.items[i].disabled) { this.cursor = i; return; }
    }
  }
}

/** Próximo valor de `arr` a partir de `cur` (com volta). */
export function cycle<T>(arr: readonly T[], cur: T, d: number): T {
  const i = Math.max(0, arr.indexOf(cur));
  return arr[(((i + d) % arr.length) + arr.length) % arr.length];
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
```

- [ ] **Step 5: Criar** `web/src/screens/ui.ts`:

```ts
import type { SpriteBank } from '../render/sprite-bank';
import { drawTextCentered, SCREEN_W, SCREEN_H } from '../render/draw-game';
import type { MenuList } from './menu';

export const COLORS = {
  title: '#ffd23f', text: '#ffffff', dim: '#6f7a99', value: '#6ad0ff', error: '#ff5f5f', ok: '#5fe07a',
  bgA: '#141a3a', bgB: '#18204a', panel: '#0b1f3d', panelEdge: '#ffd23f', panelShadow: '#050b18',
};

/** Cores dos cursores de cada jogador (P1..P5). */
export const PLAYER_COLORS = ['#ff5f5f', '#5fa8ff', '#ffd23f', '#5fe07a', '#c77dff'];

export const ROW_H = 16;
/** Linha de base do painel dos menus (o rodapé fica logo abaixo). */
export const MENU_BOTTOM = 202;

/** Fundo xadrez que desliza na diagonal. */
export function drawBackground(ctx: CanvasRenderingContext2D, frame: number): void {
  const off = (frame >> 1) % 32;
  ctx.fillStyle = COLORS.bgA;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = COLORS.bgB;
  for (let y = -32; y < SCREEN_H + 32; y += 16) for (let x = -32; x < SCREEN_W + 32; x += 16) {
    if (((x + y) / 16) % 2 === 0) ctx.fillRect(x + off, y + off, 16, 16);
  }
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLORS.panelShadow;
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

export function drawText(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, x: number, y: number, color: string): void {
  ctx.drawImage(bank.text(text, color), x, y);
}

export function drawTextRight(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, right: number, y: number, color: string): void {
  const img = bank.text(text, color);
  ctx.drawImage(img, right - img.width, y);
}

/** Setinha que aponta para a opção selecionada (pisca de leve). */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, color = COLORS.title): void {
  const dx = (frame >> 3) & 1;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + dx + i, y + i, 1, 7 - 2 * i);
}

export function drawTitleBar(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string): void {
  drawTextCentered(ctx, bank, text, COLORS.title, 12, 2);
}

/** Desenha a lista: rótulo à esquerda, valor alinhado à direita, cursor na linha atual. */
export function drawMenu(ctx: CanvasRenderingContext2D, bank: SpriteBank, list: MenuList, x: number, y: number, w: number, frame: number, rowH = ROW_H): void {
  list.items.forEach((it, i) => {
    const ry = y + i * rowH;
    const color = it.disabled ? COLORS.dim : COLORS.text;
    drawText(ctx, bank, it.label, x, ry, color);
    if (it.value) drawTextRight(ctx, bank, it.value(), x + w, ry, it.disabled ? COLORS.dim : (it.valueColor?.() ?? COLORS.value));
    if (i === list.cursor) drawCursor(ctx, x - 10, ry + 3, frame);
  });
}

/** Onde o painel de uma página de menu fica: abaixo do título e acima do rodapé. */
export function menuPanelRect(items: number, width = 200, rowH = ROW_H): { x: number; y: number; w: number; h: number } {
  const h = items * rowH + 14;
  const x = Math.floor((SCREEN_W - width) / 2);
  const y = Math.max(44, Math.min(Math.floor((SCREEN_H - h) / 2) + 8, MENU_BOTTOM - h));
  return { x, y, w: width, h };
}

/** Página padrão de menu: fundo, título e painel central com a lista. */
export function drawMenuPage(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number, title: string, list: MenuList, width = 200, rowH = ROW_H): void {
  drawBackground(ctx, frame);
  drawTitleBar(ctx, bank, title);
  const r = menuPanelRect(list.items.length, width, rowH);
  drawPanel(ctx, r.x, r.y, r.w, r.h);
  drawMenu(ctx, bank, list, r.x + 16, r.y + 7, r.w - 26, frame, rowH);
}

/** Linha de ajuda ou de erro no rodapé. */
export function drawFooter(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color = COLORS.dim): void {
  drawTextCentered(ctx, bank, text, color, SCREEN_H - 16, 1);
}
```

- [ ] **Step 6: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 155 testes PASS; tsc limpo

- [ ] **Step 7: Commit**

```bash
git add web/src/app/app.ts web/src/screens/menu.ts web/src/screens/ui.ts web/tests/client/menu.test.ts
git commit -m "feat(client): roteador de telas e kit de menus (lista navegável, painel, cursor, rodapé)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: As telas (título → modo VS → modo → jogadores → regras → personagens → fase → batalha; configurações)

**Files:**
- Create: `web/src/screens/title.ts`, `vs.ts`, `players.ts`, `rules.ts`, `characters.ts`, `stage.ts`, `battle.ts`, `settings-screen.ts`, `web/tests/client/screens.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–4; `createSession`, `tickGame`, `createView`, `drawSession` (Planos 2–3); `LAYOUTS`, `STAGE_NAMES`, `THEMES`, `CHARACTERS`
- Produces: `titleScreen(app)`, `vsModeScreen(app)`, `modeScreen(app)`, `playersScreen(app)` (+ `ERROR_FRAMES`, `TEAM_LABEL`, `TEAM_COLOR`), `rulesScreen(app)` (+ `CPU_LEVEL_LABELS`, `TIME_LABELS`), `charactersScreen(app)` (+ `AUTO_ADVANCE_FRAMES`, `locked`), `stageScreen(app)` (+ `START_DELAY_FRAMES`, `starting`, `drawMiniArena`), `battleScreen(app, cfg, initialPads)` (+ `session`), `settingsScreen(app)`, `namesScreen(app)` (+ `editing`), `remapScreen(app, 0|1)` (+ `capturing`), `DEVICE_LABEL`

As telas se importam em ciclo (o título leva ao VS, o VS volta ao título…). Isso é seguro porque as referências só são usadas dentro das funções, nunca no carregamento do módulo.

- [ ] **Step 1: Escrever o teste** `web/tests/client/screens.test.ts`:

```ts
import { App } from '../../src/app/app';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';
import { BTN } from '../../src/core';
import type { Session } from '../../src/game/session';
import { titleScreen } from '../../src/screens/title';
import { playersScreen, ERROR_FRAMES } from '../../src/screens/players';
import { rulesScreen } from '../../src/screens/rules';
import { charactersScreen, AUTO_ADVANCE_FRAMES } from '../../src/screens/characters';
import { stageScreen, START_DELAY_FRAMES } from '../../src/screens/stage';
import { settingsScreen, namesScreen, remapScreen } from '../../src/screens/settings-screen';

function mkApp(settings: Settings = defaultSettings()) {
  let saves = 0;
  const keymaps: unknown[] = [];
  const app = new App(settings, { save: () => { saves++; }, setKeymaps: m => { keymaps.push(m); }, seed: () => 1 });
  return { app, saves: () => saves, keymaps };
}

/** Aperta e solta um botão: em qualquer dispositivo (menus) e, se `slot` for dado, no dispositivo daquele jogador. */
function press(app: App, btn: number, slot?: number) {
  const i = idleInput();
  i.any = i.pressedAny = btn;
  if (slot !== undefined) { i.pads[slot] = btn; i.pressed[slot] = btn; }
  app.update(i);
  app.update(idleInput());
}
const idle = (app: App, n: number) => { for (let k = 0; k < n; k++) app.update(idleInput()); };

describe('título e modos', () => {
  it('cursor começa em JOGO DE BATALHA (JOGO NORMAL está "em breve")', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A);
    expect(app.screen.id).toBe('vs');
  });
  it('título → CONFIGURAÇÕES', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.DOWN); press(app, BTN.START);
    expect(app.screen.id).toBe('settings');
  });
  it('VS → Battle Royale → Batalha em Times grava o modo e vai para jogadores; B volta', () => {
    const { app, saves } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A); press(app, BTN.A);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.DOWN); press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(app.settings.setup.mode).toBe('team');
    expect(saves()).toBeGreaterThan(0);
    press(app, BTN.B);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.B); press(app, BTN.B);
    expect(app.screen.id).toBe('title');
  });
});

describe('jogadores', () => {
  it('ESQ/DIR alterna Humano → CPU → Desligado', () => {
    const { app } = mkApp();
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('cpu');
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('off');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(app.settings.setup.slots[0]).toBe('human');
  });
  it('nos times, a opção inclui o time', () => {
    const { app } = mkApp();
    app.settings.setup.mode = 'team';
    app.settings.setup.teams[0] = 0;
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['human', 1]);
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['cpu', 0]);
  });
  it('formação inválida mostra erro e não avança; válida vai para regras', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    const scr = playersScreen(app) as ReturnType<typeof playersScreen> & { error: string };
    app.go(scr);
    press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(scr.error).toBe('PRECISA DE 2 JOGADORES');
    idle(app, ERROR_FRAMES);
    expect(scr.error).toBe('');
    press(app, BTN.DOWN); press(app, BTN.LEFT); // 2º jogador: desligado → CPU
    press(app, BTN.A);
    expect(app.screen.id).toBe('rules');
  });
});

describe('regras', () => {
  it('ajusta valores com limites e alterna ligado/desligado', () => {
    const { app } = mkApp();
    const r = app.settings.setup.rules;
    app.go(rulesScreen(app));
    press(app, BTN.DOWN);                       // coroas
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(r.matches).toBe(5);
    press(app, BTN.UP); press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(r.cpuLevel).toBe(0);
    press(app, BTN.DOWN); press(app, BTN.DOWN); press(app, BTN.DOWN); // morte súbita
    press(app, BTN.RIGHT);
    expect(r.suddenDeath).toBe(true);
    press(app, BTN.A);
    expect(app.screen.id).toBe('characters');
  });
  it('B volta para jogadores', () => {
    const { app } = mkApp();
    app.go(rulesScreen(app));
    press(app, BTN.B);
    expect(app.screen.id).toBe('players');
  });
});

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
});

describe('fase e batalha', () => {
  it('ESQ/DIR trocam a fase com volta', () => {
    const { app } = mkApp();
    app.go(stageScreen(app));
    press(app, BTN.LEFT);
    expect(app.settings.setup.stage).toBe(10);
    press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(app.settings.setup.stage).toBe(2);
  });
  it('A mostra BATALHA! e depois abre a partida com a formação escolhida', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'cpu', 'off', 'human', 'off'];
    app.settings.setup.stage = 3;
    app.settings.names[0] = 'ANA';
    const scr = stageScreen(app);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.starting).toBe(START_DELAY_FRAMES - 1);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    const s = (app.screen as unknown as { session: Session }).session;
    expect(s.cfg.stage).toBe(3);
    expect(s.cfg.humans).toEqual([true, false, false, true, false]);
    expect(s.cfg.rules.active).toEqual([true, true, false, true, false]);
    expect(s.cfg.names[0]).toBe('ANA');
  });
  it('sair pela pausa volta para a seleção de fase; a animação congela na pausa', () => {
    const { app } = mkApp();
    const scr = stageScreen(app);
    app.go(scr);
    press(app, BTN.A);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    press(app, BTN.START, 0);
    const f = app.frame;
    idle(app, 10);
    expect(app.frame).toBe(f);
    press(app, BTN.B, 0);
    expect(app.screen.id).toBe('stage');
  });
});

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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/client/screens.test.ts`
Expected: FAIL (telas inexistentes)

- [ ] **Step 3: Criar** `web/src/screens/title.ts`:

```ts
import type { App, Screen } from '../app/app';
import { drawTextCentered, SCREEN_W } from '../render/draw-game';
import { MenuList } from './menu';
import { COLORS, drawBackground, drawFooter, drawMenu, drawPanel } from './ui';
import { vsModeScreen } from './vs';
import { settingsScreen } from './settings-screen';

export function titleScreen(app: App): Screen {
  const list = new MenuList([
    { label: 'JOGO NORMAL', value: () => 'EM BREVE', disabled: true },
    { label: 'JOGO DE BATALHA', select: () => app.go(vsModeScreen(app)) },
    { label: 'CONFIGURAÇÕES', select: () => app.go(settingsScreen(app)) },
  ]);
  return {
    id: 'title',
    update(inp) { list.handle(inp.pressedAny); },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 22, 36, 24);
      drawTextCentered(ctx, bank, 'CROWN BLAST', COLORS.title, 54, 3);
      drawPanel(ctx, 40, 116, 176, 62);
      drawMenu(ctx, bank, list, 56, 124, 148, frame);
      drawFooter(ctx, bank, 'ENTER / START PARA ESCOLHER');
    },
  };
}
```

- [ ] **Step 4: Criar** `web/src/screens/vs.ts`:

```ts
import type { App, Screen } from '../app/app';
import { MenuList } from './menu';
import { drawMenuPage } from './ui';
import { titleScreen } from './title';
import { playersScreen } from './players';

export function vsModeScreen(app: App): Screen {
  const list = new MenuList([
    { label: 'BATTLE ROYALE', select: () => app.go(modeScreen(app)) },
    { label: 'CHAMPIONSHIP', value: () => 'EM BREVE', disabled: true },
    { label: 'BOMBERMANIA', value: () => 'EM BREVE', disabled: true },
  ]);
  return {
    id: 'vs',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(titleScreen(app)); },
    draw(ctx, bank, frame) { drawMenuPage(ctx, bank, frame, 'ESCOLHA O MODO VS', list); },
  };
}

export function modeScreen(app: App): Screen {
  const setup = app.settings.setup;
  const pick = (mode: 'ffa' | 'team') => () => { setup.mode = mode; app.save(); app.go(playersScreen(app)); };
  const list = new MenuList([
    { label: 'TODOS CONTRA TODOS', select: pick('ffa') },
    { label: 'BATALHA EM TIMES', select: pick('team') },
  ]);
  if (setup.mode === 'team') list.cursor = 1;
  return {
    id: 'mode',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(vsModeScreen(app)); },
    draw(ctx, bank, frame) { drawMenuPage(ctx, bank, frame, 'BATTLE ROYALE', list); },
  };
}
```

- [ ] **Step 5: Criar** `web/src/screens/players.ts`:

```ts
import type { App, Screen } from '../app/app';
import type { SlotKind } from '../app/settings';
import { validateSetup } from '../game/config';
import { MenuList, type MenuItem } from './menu';
import { COLORS, drawFooter, drawMenuPage } from './ui';
import { modeScreen } from './vs';
import { rulesScreen } from './rules';

interface SlotOption { kind: SlotKind; team: number }

const FFA_OPTIONS: SlotOption[] = [{ kind: 'human', team: -1 }, { kind: 'cpu', team: -1 }, { kind: 'off', team: -1 }];
const TEAM_OPTIONS: SlotOption[] = [
  { kind: 'human', team: 0 }, { kind: 'human', team: 1 }, { kind: 'cpu', team: 0 }, { kind: 'cpu', team: 1 }, { kind: 'off', team: -1 },
];
const KIND_LABEL: Record<SlotKind, string> = { human: 'HUMANO', cpu: 'CPU', off: 'DESLIGADO' };
export const TEAM_LABEL = ['VERMELHO', 'BRANCO'];
export const TEAM_COLOR = ['#ff5f5f', '#ffffff'];
export const ERROR_FRAMES = 150;

/** "Defina os jogadores": Humano / CPU / Desligado (e o time, na batalha em times). */
export function playersScreen(app: App): Screen {
  const setup = app.settings.setup;
  let error = '';
  let errorTimer = 0;
  const options = () => (setup.mode === 'team' ? TEAM_OPTIONS : FFA_OPTIONS);
  const current = (i: number) => Math.max(0, options().findIndex(o =>
    o.kind === setup.slots[i] && (setup.mode !== 'team' || o.kind === 'off' || o.team === setup.teams[i])));
  const change = (i: number, d: number) => {
    const opts = options();
    const o = opts[(current(i) + d + opts.length) % opts.length];
    setup.slots[i] = o.kind;
    if (o.team >= 0) setup.teams[i] = o.team;
    app.save();
  };
  const label = (i: number) => {
    const k = setup.slots[i];
    return setup.mode === 'team' && k !== 'off' ? `${KIND_LABEL[k]} ${TEAM_LABEL[setup.teams[i]]}` : KIND_LABEL[k];
  };
  const color = (i: number) => {
    if (setup.slots[i] === 'off') return COLORS.dim;
    return setup.mode === 'team' ? TEAM_COLOR[setup.teams[i]] : setup.slots[i] === 'human' ? COLORS.ok : COLORS.value;
  };
  const confirm = () => {
    const err = validateSetup(setup.mode, setup.slots, setup.teams);
    if (err) { error = err; errorTimer = ERROR_FRAMES; return; }
    app.go(rulesScreen(app));
  };
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `${i + 1}º JOGADOR`, value: () => label(i), valueColor: () => color(i),
    left: () => change(i, -1), right: () => change(i, 1), select: confirm,
  }));
  items.push({ label: 'CONTINUAR', select: confirm });
  const list = new MenuList(items);
  return {
    id: 'players',
    update(inp) {
      if (errorTimer > 0) errorTimer--;
      if (list.handle(inp.pressedAny) === 'back') app.go(modeScreen(app));
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'DEFINA OS JOGADORES', list, 224);
      if (errorTimer > 0) drawFooter(ctx, bank, error, COLORS.error);
      else drawFooter(ctx, bank, 'ESQ/DIR: MUDAR   A: CONTINUAR');
    },
    get error() { return errorTimer > 0 ? error : ''; },
  } as Screen & { readonly error: string };
}
```

- [ ] **Step 6: Criar** `web/src/screens/rules.ts`:

```ts
import type { App, Screen } from '../app/app';
import type { RuleChoices } from '../app/settings';
import { MenuList, clamp, type MenuItem } from './menu';
import { drawFooter, drawMenuPage } from './ui';
import { playersScreen } from './players';
import { charactersScreen } from './characters';

export const CPU_LEVEL_LABELS = ['FRACO', 'NORMAL', 'FORTE'];
export const TIME_LABELS = ['1:00', '2:00', '3:00', '5:00', 'SEM LIMITE'];
const onOff = (b: boolean) => (b ? 'LIGADO' : 'DESLIGADO');

/** "Configure as regras": os 6 ajustes do original + spawn aleatório. */
export function rulesScreen(app: App): Screen {
  const r = app.settings.setup.rules;
  const next = () => { app.save(); app.go(charactersScreen(app)); };
  const setNum = (key: 'cpuLevel' | 'matches' | 'timeIdx', v: number) => {
    if (key === 'cpuLevel') r.cpuLevel = v as 0 | 1 | 2;
    else r[key] = v;
    app.save();
  };
  const numeric = (label: string, get: () => string, key: 'cpuLevel' | 'matches' | 'timeIdx', min: number, max: number): MenuItem => ({
    label, value: get, select: next,
    left: () => setNum(key, clamp(r[key] - 1, min, max)),
    right: () => setNum(key, clamp(r[key] + 1, min, max)),
  });
  const toggle = (label: string, key: keyof Pick<RuleChoices, 'suddenDeath' | 'badBomber' | 'racer' | 'randomSpawns'>): MenuItem => ({
    label, value: () => onOff(r[key]), select: next,
    left: () => { r[key] = !r[key]; app.save(); },
    right: () => { r[key] = !r[key]; app.save(); },
  });
  const list = new MenuList([
    numeric('NÍVEL DA CPU', () => CPU_LEVEL_LABELS[r.cpuLevel], 'cpuLevel', 0, 2),
    numeric('COROAS PARA VENCER', () => String(r.matches), 'matches', 1, 5),
    numeric('TEMPO', () => TIME_LABELS[r.timeIdx], 'timeIdx', 0, 4),
    toggle('MORTE SÚBITA', 'suddenDeath'),
    toggle('BOMBER VINGADOR', 'badBomber'),
    toggle('CORRIDA', 'racer'),
    toggle('SPAWN ALEATÓRIO', 'randomSpawns'),
    { label: 'CONTINUAR', select: next },
  ]);
  return {
    id: 'rules',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(playersScreen(app)); },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'CONFIGURE AS REGRAS', list, 224);
      drawFooter(ctx, bank, 'ESQ/DIR: MUDAR   A: CONTINUAR');
    },
  };
}
```

- [ ] **Step 7: Criar** `web/src/screens/characters.ts`:

```ts
import { BTN } from '../core';
import type { App, Screen } from '../app/app';
import { CHARACTERS } from '../render/art/bomber';
import { displayName } from '../game/config';
import { COLORS, PLAYER_COLORS, drawBackground, drawFooter, drawPanel, drawText, drawTitleBar } from './ui';
import { rulesScreen } from './rules';
import { stageScreen } from './stage';

const COLS = 3;
const ROWS = 2;
export const AUTO_ADVANCE_FRAMES = 90;
const GRID_X = 100, GRID_Y = 42, CELL_W = 48, CELL_H = 66;

/** "Escolha um personagem": cada jogador humano move o próprio cursor com o próprio controle. */
export function charactersScreen(app: App): Screen & { readonly locked: readonly boolean[] } {
  const setup = app.settings.setup;
  const human = (i: number) => setup.slots[i] === 'human';
  // CPUs, desligados e humanos sem controle já começam prontos.
  const locked = [0, 1, 2, 3, 4].map(i => !human(i) || app.settings.devices[i] === 'none');
  let readyFrames = 0;

  const moveCursor = (i: number, p: number) => {
    const c = setup.chars[i];
    const col = c % COLS, row = Math.floor(c / COLS);
    if (p & BTN.LEFT) setup.chars[i] = row * COLS + (col + COLS - 1) % COLS;
    if (p & BTN.RIGHT) setup.chars[i] = row * COLS + (col + 1) % COLS;
    if (p & (BTN.UP | BTN.DOWN)) setup.chars[i] = ((row + 1) % ROWS) * COLS + col;
  };

  return {
    id: 'characters',
    get locked() { return locked; },
    update(inp) {
      let wantsBack = false;
      for (let i = 0; i < 5; i++) {
        if (!human(i)) continue;
        const p = inp.pressed[i];
        if (!locked[i]) {
          moveCursor(i, p);
          if (p & BTN.A) locked[i] = true;
          else if (p & BTN.B) wantsBack = true;
        } else if (p & BTN.B) {
          locked[i] = false;
        }
      }
      if (wantsBack && [0, 1, 2, 3, 4].every(i => !human(i) || !locked[i] || app.settings.devices[i] === 'none')) {
        app.save();
        app.go(rulesScreen(app));
        return;
      }
      if (locked.every(Boolean)) {
        readyFrames++;
        if (readyFrames > AUTO_ADVANCE_FRAMES || (readyFrames > 1 && (inp.pressedAny & (BTN.START | BTN.A)))) {
          app.save();
          app.go(stageScreen(app));
        }
      } else {
        readyFrames = 0;
      }
    },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      drawTitleBar(ctx, bank, 'ESCOLHA O PERSONAGEM');
      // coluna da esquerda: quem joga e o estado de cada um
      let row = 0;
      for (let i = 0; i < 5; i++) {
        if (setup.slots[i] === 'off') continue;
        const y = GRID_Y - 4 + row * 30;
        row++;
        drawPanel(ctx, 6, y, 88, 28);
        ctx.drawImage(bank.head(setup.chars[i]), 10, y + 7);
        drawText(ctx, bank, displayName(app.settings.names, i), 28, y + 2, PLAYER_COLORS[i]);
        const status = !human(i) ? 'CPU' : locked[i] ? 'PRONTO' : 'ESCOLHENDO';
        drawText(ctx, bank, status, 28, y + 14, !human(i) ? COLORS.value : locked[i] ? COLORS.ok : COLORS.dim);
      }
      // grade de personagens
      drawPanel(ctx, GRID_X - 4, GRID_Y - 4, COLS * CELL_W + 8, ROWS * CELL_H + 8);
      CHARACTERS.forEach((c, k) => {
        const x = GRID_X + (k % COLS) * CELL_W, y = GRID_Y + Math.floor(k / COLS) * CELL_H;
        ctx.drawImage(bank.bomber(k, 2, 0), x + 8, y + 8, 32, 40);
        const name = bank.text(c.name, COLORS.text);
        ctx.drawImage(name, x + Math.floor((CELL_W - name.width) / 2), y + 52);
      });
      // cursores (um por humano), com recuo diferente para não se sobreporem
      for (let i = 0; i < 5; i++) {
        if (!human(i)) continue;
        const k = setup.chars[i];
        const x = GRID_X + (k % COLS) * CELL_W, y = GRID_Y + Math.floor(k / COLS) * CELL_H;
        const inset = i * 2;
        if (!locked[i] && ((frame >> 3) & 1)) continue;
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 1;
        ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, CELL_W - 1 - inset * 2, CELL_H - 1 - inset * 2);
        drawText(ctx, bank, `${i + 1}P`, x + 2 + inset, y + 1 + inset, PLAYER_COLORS[i]);
      }
      drawFooter(ctx, bank, locked.every(Boolean) ? 'TODOS PRONTOS! START PARA SEGUIR' : 'A: ESCOLHER   B: DESFAZER');
    },
  };
}
```

- [ ] **Step 8: Criar** `web/src/screens/stage.ts`:

```ts
import { BTN, LAYOUTS, STAGE_NAMES } from '../core';
import type { App, Screen } from '../app/app';
import { THEMES } from '../render/art/tiles';
import { SCREEN_W, drawTextCentered } from '../render/draw-game';
import { configFromSetup } from '../game/config';
import { COLORS, drawBackground, drawFooter, drawPanel, drawTitleBar } from './ui';
import { charactersScreen } from './characters';
import { battleScreen } from './battle';

export const START_DELAY_FRAMES = 45;
const STAGES = 10;

/** Miniatura da arena (15×13 casas de `cell` px) com as cores do tema. */
export function drawMiniArena(ctx: CanvasRenderingContext2D, stage: number, x: number, y: number, cell: number): void {
  const t = THEMES[stage - 1];
  const rows = LAYOUTS[stage - 1];
  for (let gy = 0; gy < 13; gy++) for (let gx = 0; gx < 15; gx++) {
    let color: string;
    if (gx === 0 || gy === 0 || gx === 14 || gy === 12) color = t.wallFace;
    else {
      const ch = rows[gy - 1][gx - 1];
      color = ch === '#' ? t.hardFace : ch === 'x' ? t.softA : (gx + gy) % 2 ? t.floorB : t.floorA;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x + gx * cell, y + gy * cell, cell, cell);
  }
}

/** "Escolha uma fase": miniatura no centro, vizinhas nas laterais, "FASE N / nome". */
export function stageScreen(app: App): Screen & { readonly starting: number } {
  const setup = app.settings.setup;
  let starting = 0;
  const shift = (d: number) => { setup.stage = ((setup.stage - 1 + d + STAGES) % STAGES) + 1; app.save(); };
  return {
    id: 'stage',
    get starting() { return starting; },
    update(inp) {
      if (starting > 0) {
        if (--starting === 0) app.go(battleScreen(app, configFromSetup(setup, app.settings.names), inp.pads));
        return;
      }
      const p = inp.pressedAny;
      if (p & BTN.LEFT) shift(-1);
      else if (p & BTN.RIGHT) shift(1);
      else if (p & (BTN.A | BTN.START)) starting = START_DELAY_FRAMES;
      else if (p & BTN.B) app.go(charactersScreen(app));
    },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      drawTitleBar(ctx, bank, starting > 0 ? 'BATALHA!' : 'ESCOLHA A FASE');
      const prev = ((setup.stage + STAGES - 2) % STAGES) + 1, next = (setup.stage % STAGES) + 1;
      ctx.globalAlpha = 0.55;
      drawMiniArena(ctx, prev, 8, 70, 3);
      drawMiniArena(ctx, next, SCREEN_W - 8 - 45, 70, 3);
      ctx.globalAlpha = 1;
      drawPanel(ctx, 86, 50, 84, 74);
      drawMiniArena(ctx, setup.stage, 91, 55, 5);
      drawTextCentered(ctx, bank, `FASE ${setup.stage}`, COLORS.title, 134, 2);
      drawTextCentered(ctx, bank, STAGE_NAMES[setup.stage - 1], COLORS.text, 164, 1);
      drawFooter(ctx, bank, 'ESQ/DIR: TROCAR   A: JOGAR   B: VOLTAR');
    },
  };
}
```

- [ ] **Step 9: Criar** `web/src/screens/battle.ts`:

```ts
import type { App, Screen } from '../app/app';
import type { GameConfig } from '../game/config';
import { createSession, type Session } from '../game/session';
import { tickGame } from '../app/tick';
import { createView } from '../render/view';
import { drawSession } from '../render/draw-screens';
import { stageScreen } from './stage';

/** Hospeda uma partida. Quando ela termina (vitória confirmada ou saída pela pausa) volta para a seleção de fase. */
export function battleScreen(app: App, cfg: GameConfig, initialPads: number[]): Screen & { readonly session: Session } {
  const session = createSession(cfg, cfg.seed ?? app.seed(), initialPads);
  const view = createView();
  return {
    id: 'battle',
    session,
    update(inp) {
      tickGame(session, view, inp.pads);
      if (session.finished) app.go(stageScreen(app));
    },
    draw(ctx, bank, frame) { drawSession(ctx, session, view, bank, frame); },
    frozen: () => session.paused,
  };
}
```

- [ ] **Step 10: Criar** `web/src/screens/settings-screen.ts`:

```ts
import { BTN } from '../core';
import type { App, Screen } from '../app/app';
import { NAME_CHARS, NAME_MAX, defaultSettings, sanitizeName } from '../app/settings';
import { DEVICE_IDS, KEY_FIELDS, keyLabel, type DeviceId, type KeyMap } from '../input/input';
import { MenuList, cycle, type MenuItem } from './menu';
import { COLORS, ROW_H, drawFooter, drawMenuPage, menuPanelRect } from './ui';
import { titleScreen } from './title';

export const DEVICE_LABEL: Record<DeviceId, string> = {
  kb0: 'TECLADO 1', kb1: 'TECLADO 2', gp0: 'CONTROLE 1', gp1: 'CONTROLE 2', gp2: 'CONTROLE 3', gp3: 'CONTROLE 4', none: 'NENHUM',
};

/** CONFIGURAÇÕES: qual dispositivo controla cada jogador, nomes, teclas e restaurar padrão. */
export function settingsScreen(app: App): Screen {
  const st = app.settings;
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `JOGADOR ${i + 1}`, value: () => DEVICE_LABEL[st.devices[i]],
    left: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], -1); app.save(); },
    right: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], 1); app.save(); },
  }));
  items.push(
    { label: 'NOMES DOS JOGADORES', select: () => app.go(namesScreen(app)) },
    { label: 'TECLAS DO TECLADO 1', select: () => app.go(remapScreen(app, 0)) },
    { label: 'TECLAS DO TECLADO 2', select: () => app.go(remapScreen(app, 1)) },
    {
      label: 'RESTAURAR PADRÃO', select: () => {
        const d = defaultSettings();
        st.devices = d.devices; st.keymaps = d.keymaps; st.names = d.names;
        app.applyKeymaps(); app.save();
      },
    },
    { label: 'VOLTAR', select: () => app.go(titleScreen(app)) },
  );
  const list = new MenuList(items);
  return {
    id: 'settings',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(titleScreen(app)); },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'CONFIGURAÇÕES', list, 224, 14);
      drawFooter(ctx, bank, 'ESQ/DIR: TROCAR O CONTROLE');
    },
  };
}

/** Nomes dos jogadores, editados letra a letra (funciona com teclado e com controle). */
export function namesScreen(app: App): Screen & { readonly editing: number } {
  const st = app.settings;
  let editing = -1;
  let pos = 0;
  let buf: string[] = [];
  const letters = [...NAME_CHARS];
  const commit = () => { st.names[editing] = sanitizeName(buf.join('')); app.save(); editing = -1; };
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `JOGADOR ${i + 1}`,
    value: () => (editing === i ? '' : st.names[i] || '---'),
    select: () => { editing = i; pos = 0; buf = st.names[i].padEnd(NAME_MAX, ' ').split(''); },
  }));
  items.push({ label: 'VOLTAR', select: () => app.go(settingsScreen(app)) });
  const list = new MenuList(items);
  return {
    id: 'names',
    get editing() { return editing; },
    update(inp) {
      const p = inp.pressedAny;
      if (editing < 0) {
        if (list.handle(p) === 'back') app.go(settingsScreen(app));
        return;
      }
      if (p & BTN.UP) buf[pos] = cycle(letters, buf[pos], 1);
      if (p & BTN.DOWN) buf[pos] = cycle(letters, buf[pos], -1);
      if (p & BTN.RIGHT) pos = Math.min(NAME_MAX - 1, pos + 1);
      if (p & BTN.LEFT) pos = Math.max(0, pos - 1);
      if (p & BTN.START) commit();
      else if (p & BTN.A) { if (pos < NAME_MAX - 1) pos++; else commit(); }
      else if (p & BTN.B) editing = -1;
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'NOMES', list, 200);
      if (editing >= 0) {
        // mesma geometria de drawMenuPage (painel de 200 px)
        const r = menuPanelRect(list.items.length, 200);
        const y = r.y + 7 + editing * ROW_H;
        const x0 = r.x + 16 + (r.w - 26) - NAME_MAX * 6;
        buf.forEach((ch, k) => {
          const img = bank.text(ch === ' ' ? '-' : ch, k === pos ? COLORS.title : COLORS.value);
          if (!(k === pos && ((frame >> 3) & 1))) ctx.drawImage(img, x0 + k * 6, y);
        });
        drawFooter(ctx, bank, 'CIMA/BAIXO: LETRA  A: PRÓXIMA  START: OK');
      } else {
        drawFooter(ctx, bank, 'A: EDITAR   B: VOLTAR');
      }
    },
  };
}

const ACTION_LABEL: Record<keyof KeyMap, string> = {
  up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA', a: 'A (BOMBA)', b: 'B', y: 'Y (SOCO)', start: 'START',
};

/** Remapeia as teclas de um dos dois conjuntos de teclado: A na ação e depois a nova tecla (ESC cancela). */
export function remapScreen(app: App, k: 0 | 1): Screen & { readonly capturing: keyof KeyMap | null } {
  const map = app.settings.keymaps[k];
  let capturing: keyof KeyMap | null = null;
  const items: MenuItem[] = KEY_FIELDS.map(f => ({
    label: ACTION_LABEL[f],
    value: () => (capturing === f ? '...' : keyLabel(map[f])),
    select: () => { capturing = f; },
  }));
  items.push({ label: 'VOLTAR', select: () => app.go(settingsScreen(app)) });
  const list = new MenuList(items);
  return {
    id: 'remap',
    get capturing() { return capturing; },
    update(inp) {
      if (capturing) {
        if (inp.key) {
          if (inp.key !== 'Escape') { map[capturing] = inp.key; app.applyKeymaps(); app.save(); }
          capturing = null;
        }
        return;
      }
      if (list.handle(inp.pressedAny) === 'back') app.go(settingsScreen(app));
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, `TECLADO ${k + 1}`, list, 200);
      drawFooter(ctx, bank, capturing ? 'APERTE A NOVA TECLA (ESC CANCELA)' : 'A: MUDAR TECLA   B: VOLTAR', capturing ? COLORS.title : COLORS.dim);
    },
  };
}
```

- [ ] **Step 11: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: 176 testes PASS; tsc limpo

- [ ] **Step 12: Commit**

```bash
git add web/src/screens web/tests/client/screens.test.ts
git commit -m "feat(client): telas de menu (título, modo VS, jogadores, regras, personagens, fase, batalha, configurações)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ligar tudo no `main.ts` e verificar com screenshots

**Files:**
- Replace: `web/src/main.ts` (final), `web/src/render/draw-screens.ts` (final, sem o `drawTitle` antigo), `web/scripts/snapshots.mjs`

**Interfaces:**
- Consumes: `App`, `titleScreen`, `battleScreen`, `InputManager`, `buildInput`, `emptyDevices`, `loadSettings`, `saveSettings`, `browserStorage`, `parseConfig`
- Produces: o jogo abre no título; `?quick` abre direto numa partida com as regras da URL; `window.__crown = { app, session }` só em desenvolvimento com `?debug`

- [ ] **Step 1: Substituir** `web/src/main.ts` por:

```ts
import { App } from './app/app';
import { browserStorage, loadSettings, saveSettings } from './app/settings';
import { startLoop } from './app/loop';
import { parseConfig } from './game/config';
import type { Session } from './game/session';
import { InputManager, buildInput, emptyDevices } from './input/input';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { titleScreen } from './screens/title';
import { battleScreen } from './screens/battle';

const store = browserStorage();
const settings = loadSettings(store);
const input = new InputManager(window, settings.keymaps);
const app = new App(settings, {
  save: s => saveSettings(store, s),
  setKeymaps: maps => input.setKeymaps(maps),
  seed: () => Date.now() >>> 0,
});
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();

// ?quick abre direto numa partida com as regras da URL (ver parseConfig); sem ele, começa no título.
const search = window.location.search;
app.go(new URLSearchParams(search).has('quick') ? battleScreen(app, parseConfig(search), [0, 0, 0, 0, 0]) : titleScreen(app));

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
if (import.meta.env.DEV && new URLSearchParams(search).has('debug')) {
  (window as unknown as { __crown: unknown }).__crown = {
    app,
    get session(): Session | null { return (app.screen as Partial<{ session: Session }>).session ?? null; },
  };
}

let prev = emptyDevices();
startLoop(() => {
  const cur = input.poll();
  app.update(buildInput(cur, prev, app.settings.devices, input.takeLastKey()));
  prev = cur;
}, () => app.draw(ctx, bank));
```

- [ ] **Step 2: Substituir** `web/src/render/draw-screens.ts` por (igual à Task 3, mas sem o `drawTitle`, que virou a tela `title`):

```ts
import type { Session } from '../game/session';
import { SCOREBOARD_FRAMES, SKIP_AFTER } from '../game/session';
import type { SpriteBank } from './sprite-bank';
import { roundOverText, type ViewState } from './view';
import { displayName } from '../game/config';
import { drawRound, drawTextCentered, SCREEN_W, SCREEN_H } from './draw-game';

function drawScoreboard(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank): void {
  ctx.fillStyle = '#12305a';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#0b1f3d';
  ctx.fillRect(12, 34, SCREEN_W - 24, 168);
  drawTextCentered(ctx, bank, 'PLACAR', '#ffd23f', 8, 2);
  const age = SCOREBOARD_FRAMES - s.timer;
  let row = 0;
  s.round.players.forEach((p, i) => {
    if (!p.active) return;
    const y = 40 + row * 32;
    row++;
    ctx.drawImage(bank.head(s.cfg.chars[i]), 18, y + 4);
    ctx.drawImage(bank.text(displayName(s.cfg.names, i), '#ffffff'), 36, y + 6);
    for (let k = 0; k < s.match.rules.matches; k++) {
      const x = 92 + k * 31;
      ctx.fillStyle = '#050b18';
      ctx.fillRect(x, y, 28, 22);
      ctx.fillStyle = '#2a4a7a';
      ctx.fillRect(x + 1, y + 1, 26, 20);
      const won = k < s.match.crowns[i];
      const isNew = won && k === s.match.crowns[i] - 1 && s.lastWinners.includes(i);
      if (won && (!isNew || age > 40 || ((age >> 2) & 1) === 0)) ctx.drawImage(bank.crown(), x + 2, y + 3, 24, 16);
    }
  });
  drawTextCentered(ctx, bank, roundOverText(s.lastWinners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 208, 1);
}

function drawVictory(ctx: CanvasRenderingContext2D, s: Session, bank: SpriteBank, frame: number): void {
  ctx.fillStyle = '#1d1030';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 3 ? '#ffd23f' : '#ffffff';
    ctx.fillRect((i * 97 + frame) % SCREEN_W, (i * 53) % SCREEN_H, 1, 1);
  }
  drawTextCentered(ctx, bank, 'VITÓRIA!', '#ffd23f', 14, 3);
  const champs = s.champions;
  const total = champs.length * 56;
  champs.forEach((slot, k) => {
    const x = Math.floor((SCREEN_W - total) / 2) + k * 56 + 4;
    const bounce = Math.abs(Math.round(Math.sin((frame + k * 10) / 8) * 6));
    ctx.drawImage(bank.bomber(s.cfg.chars[slot], 2, 0), x, 64 - bounce, 48, 60);
  });
  ctx.drawImage(bank.trophy(), (SCREEN_W - 48) / 2, 132, 48, 48);
  const rules = s.cfg.rules;
  const who = rules.mode === 'team'
    ? (rules.teams[champs[0]] === 0 ? 'TIME VERMELHO É O CAMPEÃO!' : 'TIME BRANCO É O CAMPEÃO!')
    : `${displayName(s.cfg.names, champs[0])} É O CAMPEÃO!`;
  drawTextCentered(ctx, bank, who, '#ffffff', 188, 1);
  if (s.timer > SKIP_AFTER && ((frame >> 5) & 1) === 0) drawTextCentered(ctx, bank, 'PRESSIONE START', '#6ad0ff', 206, 1);
}

export function drawSession(ctx: CanvasRenderingContext2D, s: Session, view: ViewState, bank: SpriteBank, frame: number): void {
  switch (s.phase) {
    case 'battle':
    case 'roundOver':
      drawRound(ctx, s.round, view, bank, s.cfg.chars, frame, s.match.crowns);
      if (s.round.phase === 'intro') drawTextCentered(ctx, bank, s.round.introLeft > 30 ? 'PRONTOS?' : 'JÁ!', '#ffd23f', 100, 2);
      if (s.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 24, SCREEN_W, SCREEN_H - 24);
        drawTextCentered(ctx, bank, 'PAUSA', '#ffffff', 96, 2);
        drawTextCentered(ctx, bank, 'START: CONTINUAR   B: SAIR', '#6ad0ff', 124, 1);
      }
      if (s.phase === 'roundOver') {
        drawTextCentered(ctx, bank, roundOverText(s.round.winners, s.cfg.rules.mode, s.cfg.rules.teams, s.cfg.names), '#ffd23f', 100, 2);
      }
      break;
    case 'scoreboard':
      drawScoreboard(ctx, s, bank);
      break;
    case 'victory':
      drawVictory(ctx, s, bank, frame);
      break;
  }
}
```

- [ ] **Step 3: Substituir** `web/scripts/snapshots.mjs` por:

```js
// Requer o Google Chrome instalado (playwright-core usa channel 'chrome', não baixa o Chromium).
// Abre o jogo no Chrome instalado, joga alguns frames e salva screenshots em web/snapshots/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}snapshots`;
mkdirSync(out, { recursive: true });
const PORT = 5188;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('vite não subiu');
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 768, height: 672 } });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const tap = async code => { await page.keyboard.down(code); await sleep(60); await page.keyboard.up(code); await sleep(60); };
  const hold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  const base = `http://localhost:${PORT}/`;
  const waitScreen = id => page.waitForFunction(i => window.__crown.app.screen.id === i, id, { timeout: 15000 });

  // 1) Fluxo de menus (configurações zeradas: cada página abre com localStorage vazio)
  await page.goto(`${base}?debug=1`);
  await sleep(400); await shot('01-title');
  await tap('Enter'); await waitScreen('vs'); await shot('02-vs');
  await tap('Enter'); await waitScreen('mode'); await shot('03-mode');
  await tap('Enter'); await waitScreen('players'); await shot('04-players');
  await tap('Enter'); await waitScreen('rules'); await shot('05-rules');
  await tap('Enter'); await waitScreen('characters');
  await tap('KeyD'); await tap('ArrowDown'); await sleep(150); await shot('06-characters');
  await tap('KeyJ'); await tap('Numpad1'); await sleep(150); await shot('07-characters-ready');
  await tap('Enter'); await waitScreen('stage');
  await tap('KeyD'); await sleep(150); await shot('08-stage');
  await tap('Enter'); await sleep(200); await shot('09-battle-start');
  await waitScreen('battle'); await sleep(900); await shot('10-intro');

  // 2) Partida rápida (?quick): batalha, explosão, fim de rodada, placar, vitória e volta à fase
  await page.goto(`${base}?quick&seed=7&players=5&matches=1&spawns=0&debug=1`);
  await sleep(1700);
  await hold('KeyD', 250); await tap('KeyJ'); await hold('KeyA', 250); await hold('KeyS', 300);
  await sleep(300); await shot('11-battle');
  await page.waitForFunction(() => window.__crown.session.round.arena.flame.some(f => f > 20), null, { timeout: 5000 });
  await shot('12-explosion');
  await tap('Enter'); await sleep(150); await shot('13-pause');
  await tap('Enter');
  await page.evaluate(() => { window.__crown.session.round.players.forEach((p, i) => { if (i !== 2) p.alive = false; }); });
  await sleep(400); await shot('14-round-over');
  await page.waitForFunction(() => window.__crown.session?.phase === 'scoreboard', null, { timeout: 15000 });
  await sleep(300); await shot('15-scoreboard');
  await page.waitForFunction(() => window.__crown.session?.phase === 'victory', null, { timeout: 15000 });
  await sleep(1300); await shot('16-victory');
  await tap('Enter'); await waitScreen('stage'); await shot('17-back-to-stage');

  // 3) Configurações e nomes
  await page.goto(`${base}?debug=1`);
  await sleep(300); await tap('KeyS'); await tap('Enter'); await waitScreen('settings'); await shot('18-settings');
  for (let k = 0; k < 5; k++) await tap('KeyS');
  await tap('Enter'); await waitScreen('names');
  await tap('Enter'); for (let k = 0; k < 3; k++) await tap('KeyW');
  await sleep(100); await shot('19-name-edit');

  // 4) Outras arenas
  for (const stage of [5, 8]) {
    await page.goto(`${base}?quick&seed=3&players=5&stage=${stage}&debug=1`);
    await sleep(2000);
    await shot(stage === 5 ? '20-stage5' : '21-stage8');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    server.kill();
  }
}
console.log(`screenshots em ${out}`);
```

- [ ] **Step 4: Verificar**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx vite build && npm run snap`
Expected: tsc limpo; 176 testes PASS; build ok; `screenshots em …/web/snapshots` com 21 PNGs. Abra e descreva no relatório:
- `01-title`: menu com JOGO NORMAL cinza "EM BREVE", JOGO DE BATALHA e CONFIGURAÇÕES;
- `04-players`: 5 linhas, HUMANO/HUMANO/CPU/CPU/CPU;
- `07-characters-ready`: P1 e P2 "PRONTO", cursores 1P e 2P;
- `08-stage`: FASE 2 com miniatura;
- `13-pause`: "PAUSA" com "START: CONTINUAR   B: SAIR";
- `17-back-to-stage`: seleção de fase depois da vitória;
- `18-settings`: 10 itens sem invadir o rodapé.

- [ ] **Step 5: Commit**

```bash
git add web/src/main.ts web/src/render/draw-screens.ts web/scripts/snapshots.mjs
git commit -m "feat(client): o jogo abre no título e segue pelos menus; ?quick para partida direta; screenshots do fluxo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Próximo plano

- **Plano 4, conteúdo e integrações:**
  - IA das CPUs (Fraco/Normal/Forte) com `dangerMap` no core, que substitui os 0 que as CPUs recebem hoje;
  - mecânicas especiais das fases 2, 3, 6, 7, 8 e 9 (a 9 precisa posicionar as gangorras, porque o layout não tem `?`);
  - Bad Bomber;
  - áudio chiptune (SFX pelos eventos do core e pelos `notices`; volume em CONFIGURAÇÕES);
  - webhook Crown Cup a partir do `match_over`, com URL configurável, retry e fila offline, e com os nomes dos jogadores no payload.
