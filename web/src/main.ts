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
