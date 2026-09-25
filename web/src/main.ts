import { BTN } from './core';
import { parseConfig } from './game/config';
import { createSession, updateSession, type Session } from './game/session';
import { InputManager } from './input/input';
import { startLoop } from './app/loop';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { createView, updateView } from './render/view';
import { drawSession, drawTitle } from './render/draw-screens';

const cfg = parseConfig(window.location.search);
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();
const input = new InputManager(window);
const view = createView();
let session: Session | null = null;
let prevPads = [0, 0, 0, 0, 0];
let frame = 0;

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe com ?debug.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __crown: { readonly session: Session | null } }).__crown = { get session() { return session; } };
}

startLoop(() => {
  frame++;
  const pads = input.poll();
  if (!session) {
    const start = pads.some((p, i) => (p & ~prevPads[i] & (BTN.START | BTN.A)) !== 0);
    prevPads = pads;
    if (start) {
      session = createSession(cfg, cfg.seed ?? (Date.now() >>> 0));
      session.prevPads = [...pads]; // o START que abriu a partida não pode pausá-la
    }
    return;
  }
  const events = updateSession(session, pads);
  updateView(view, session.round, events);
}, () => {
  if (session) drawSession(ctx, session, view, bank, frame);
  else drawTitle(ctx, bank, frame);
});
