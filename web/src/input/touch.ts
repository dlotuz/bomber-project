// Controles na tela para celular/tablet: direcional e botões que viram teclas do perfil em uso (as mesmas que o teclado
// aciona), então o jogo inteiro (menus, partida local e sala online) funciona sem nenhuma mudança no resto do código.
// Só aparece em tela de toque (ponteiro "coarse") ou com ?touch na URL.
import type { KeyMap } from './input';

type Field = keyof KeyMap;
const DIRS: readonly Field[] = ['up', 'down', 'left', 'right'];
/** Distância (px) do centro do direcional abaixo da qual nada é apertado. */
const DEAD = 14;
/** Tempo mínimo (ms) que a tecla fica apertada: um toque curto não pode passar entre duas leituras do jogo (60 Hz). */
const MIN_HOLD = 70;

const CSS = `
.touch { position: fixed; inset: 0; z-index: 20; pointer-events: none; user-select: none; -webkit-user-select: none;
  touch-action: none; -webkit-touch-callout: none; font: 700 clamp(12px, 3.4vmin, 20px) system-ui, sans-serif; }
.touch > * { pointer-events: auto; touch-action: none; }
.touch .pad { position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: max(18px, env(safe-area-inset-bottom));
  width: min(38vmin, 190px); height: min(38vmin, 190px); border-radius: 50%; background: rgba(255,255,255,.12);
  border: 2px solid rgba(255,255,255,.35); }
.touch .pad i { position: absolute; width: 34%; height: 34%; border-radius: 22%; background: rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.8); font-style: normal; }
.touch .pad i.on { background: rgba(255,228,107,.55); }
.touch .pad .u { left: 33%; top: 3%; } .touch .pad .d { left: 33%; bottom: 3%; }
.touch .pad .l { left: 3%; top: 33%; } .touch .pad .r { right: 3%; top: 33%; }
.touch button { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,.45); color: #fff;
  background: rgba(255,255,255,.16); width: min(17vmin, 84px); height: min(17vmin, 84px); font: inherit; padding: 0; }
.touch button.on { background: rgba(255,228,107,.6); color: #000; }
.touch .a { right: max(16px, env(safe-area-inset-right)); bottom: max(26px, env(safe-area-inset-bottom));
  width: min(22vmin, 110px); height: min(22vmin, 110px); background: rgba(255,90,60,.4); }
.touch .b { right: calc(max(16px, env(safe-area-inset-right)) + min(24vmin, 120px)); bottom: max(18px, env(safe-area-inset-bottom)); }
.touch .y { right: calc(max(16px, env(safe-area-inset-right)) + min(24vmin, 120px) + min(1vmin, 6px)); bottom: calc(max(18px, env(safe-area-inset-bottom)) + min(20vmin, 100px)); }
.touch .x { right: max(16px, env(safe-area-inset-right)); bottom: calc(max(26px, env(safe-area-inset-bottom)) + min(26vmin, 130px)); }
.touch .start { left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); border-radius: 14px;
  width: min(24vmin, 120px); height: min(8vmin, 40px); }
.touch .zone { position: absolute; left: 0; top: 25%; bottom: 0; width: 46%; }
.touch .stick { position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: max(18px, env(safe-area-inset-bottom));
  width: min(38vmin, 190px); height: min(38vmin, 190px); border-radius: 50%; background: rgba(255,255,255,.1);
  border: 2px solid rgba(255,255,255,.3); pointer-events: none; }
.touch .stick.act { bottom: auto; transform: translate(-50%, -50%); background: rgba(255,255,255,.16); border-color: rgba(255,228,107,.7); }
.touch .stick b { position: absolute; left: 30%; top: 30%; width: 40%; height: 40%; border-radius: 50%;
  background: rgba(255,255,255,.4); border: 2px solid rgba(255,255,255,.7); }
.touch .stick.act b { background: rgba(255,228,107,.7); }
.touch.js .pad, .touch.dp .zone, .touch.dp .stick { display: none; }
@media (orientation: portrait) {
  .touch .pad, .touch .stick:not(.act) { bottom: max(70px, env(safe-area-inset-bottom)); }
  .touch .a { bottom: max(80px, env(safe-area-inset-bottom)); }
  .touch .b { bottom: max(72px, env(safe-area-inset-bottom)); }
  .touch .y { bottom: calc(max(72px, env(safe-area-inset-bottom)) + min(20vmin, 100px)); }
  .touch .x { bottom: calc(max(80px, env(safe-area-inset-bottom)) + min(26vmin, 130px)); }
}
`;

export type TouchStyle = 'joystick' | 'dpad';
const STYLE_KEY = 'crown-toque-estilo';
const styleListeners = new Set<() => void>();

/** Estilo do movimento na tela (por aparelho, guardado no navegador): joystick flutuante (padrão) ou direcional fixo. */
export function touchStyle(): TouchStyle {
  try { return localStorage.getItem(STYLE_KEY) === 'dpad' ? 'dpad' : 'joystick'; } catch { return 'joystick'; }
}
export function setTouchStyle(s: TouchStyle): void {
  try { localStorage.setItem(STYLE_KEY, s); } catch { /* sem armazenamento: vale até recarregar */ }
  memo = s;
  styleListeners.forEach(f => f());
}
let memo: TouchStyle | null = null;

/** Tela de toque? (ponteiro principal "coarse"), ou ?touch para testar no computador. */
export function isTouchDevice(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  if (new URLSearchParams(win.location.search).has('touch')) return true;
  return !!win.matchMedia?.('(pointer: coarse)').matches;
}

/**
 * Monta os controles na tela. `keymap()` devolve o perfil em uso agora (o do jogador 1, ou o do controle online na
 * partida online); cada botão aperta a tecla desse perfil, no `target` (a mesma janela em que o InputManager escuta).
 * Devolve uma função que remove tudo.
 */
export function installTouchControls(keymap: () => KeyMap, win: Window = window, doc: Document = document): () => void {
  if (!isTouchDevice(win)) return () => {};
  const style = doc.createElement('style');
  style.textContent = CSS;
  const root = doc.createElement('div');
  root.className = 'touch';
  root.setAttribute('aria-hidden', 'true');
  doc.head.append(style);

  /** Tecla (code) que cada campo apertou, para soltar a mesma mesmo se o perfil mudar no meio do toque. */
  const sent = new Map<Field, string>();
  const since = new Map<Field, number>();
  const press = (f: Field): void => {
    if (sent.has(f)) return;
    const code = keymap()[f];
    if (!code) return;
    sent.set(f, code);
    since.set(f, performance.now());
    win.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  };
  const release = (f: Field): void => {
    const code = sent.get(f);
    if (code === undefined) return;
    const wait = MIN_HOLD - (performance.now() - (since.get(f) ?? 0));
    if (wait > 0) { setTimeout(() => release(f), wait); return; }
    sent.delete(f);
    win.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
  };
  const set = (f: Field, on: boolean, el?: Element | null): void => {
    if (on) press(f); else release(f);
    el?.classList.toggle('on', on);
  };

  // joystick flutuante: o toque em qualquer ponto da metade esquerda vira o centro; arrastar escolhe a direção
  // dominante (com folga para não tremer na diagonal) e soltar para tudo
  const zone = doc.createElement('div');
  zone.className = 'zone';
  const stick = doc.createElement('div');
  stick.className = 'stick';
  const knob = doc.createElement('b');
  stick.append(knob);
  let stickId = -1, cx = 0, cy = 0, heading: Field | null = null;
  const stickEnd = (): void => {
    stickId = -1; heading = null;
    for (const f of DIRS) set(f, false);
    stick.classList.remove('act');
    stick.style.left = stick.style.top = '';
    knob.style.transform = '';
  };
  const steer = (e: PointerEvent): void => {
    const r = stick.getBoundingClientRect().width / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1, k = Math.min(1, (r * 0.6) / len);
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    let want: Field | null = null;
    if (len > r * 0.22) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      // o eixo em uso só troca quando o outro passa bem na frente (evita tremer perto da diagonal)
      const horiz = heading === 'left' || heading === 'right' ? ax * 1.35 > ay : heading ? ax > ay * 1.35 : ax > ay;
      want = horiz ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }
    heading = want;
    for (const f of DIRS) set(f, f === want);
  };
  zone.addEventListener('pointerdown', e => {
    if (stickId >= 0) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect().width / 2 || 60;
    const W = win.innerWidth, H = win.innerHeight;
    cx = Math.min(Math.max(e.clientX, r + 6), W - r - 6);
    cy = Math.min(Math.max(e.clientY, r + 6), H - r - 6);
    stick.classList.add('act');
    stick.style.left = `${cx}px`; stick.style.top = `${cy}px`;
    steer(e);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === stickId) steer(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    zone.addEventListener(ev, e => { if (e.pointerId === stickId) stickEnd(); });
  }
  root.append(zone, stick);

  // direcional fixo: o ponteiro arrastado dentro do círculo escolhe a direção dominante
  const pad = doc.createElement('div');
  pad.className = 'pad';
  const arrows: Record<string, [Field, string]> = { u: ['up', '▲'], d: ['down', '▼'], l: ['left', '◀'], r: ['right', '▶'] };
  const cells = new Map<Field, HTMLElement>();
  for (const [cls, [f, glyph]] of Object.entries(arrows)) {
    const i = doc.createElement('i');
    i.className = cls; i.textContent = glyph;
    pad.append(i);
    cells.set(f, i);
  }
  const aim = (e: PointerEvent): void => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const want = new Set<Field>();
    if (Math.max(Math.abs(dx), Math.abs(dy)) > DEAD) {
      if (Math.abs(dx) > Math.abs(dy)) want.add(dx < 0 ? 'left' : 'right'); else want.add(dy < 0 ? 'up' : 'down');
    }
    for (const f of DIRS) set(f, want.has(f), cells.get(f));
  };
  const padEnd = (): void => { for (const f of DIRS) set(f, false, cells.get(f)); };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); aim(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) aim(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) pad.addEventListener(ev, padEnd);
  root.append(pad);

  // botões de ação: A (bomba/confirma), B (volta/ação), X, Y (poder) e START
  const buttons: [Field, string, string][] = [['a', 'a', 'A'], ['b', 'b', 'B'], ['x', 'x', 'X'], ['y', 'y', 'Y'], ['start', 'start', 'START']];
  for (const [f, cls, text] of buttons) {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); set(f, true, b); e.preventDefault(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, () => set(f, false, b));
    b.addEventListener('contextmenu', e => e.preventDefault());
    root.append(b);
  }
  doc.body.append(root);

  // o toque não pode rolar/ampliar a página nem soltar menu de contexto
  const stop = (e: Event): void => e.preventDefault();
  root.addEventListener('touchstart', stop, { passive: false });
  root.addEventListener('contextmenu', stop);
  win.addEventListener('blur', () => { for (const f of [...sent.keys()]) release(f); });

  // estilo escolhido nas Opções (vale na hora; solta o que estiver apertado)
  const applyStyle = (): void => {
    const js = touchStyle() === 'joystick';
    root.classList.toggle('js', js);
    root.classList.toggle('dp', !js);
    stickEnd(); padEnd();
  };
  styleListeners.add(applyStyle);
  applyStyle();

  return () => { styleListeners.delete(applyStyle); root.remove(); style.remove(); };
}
