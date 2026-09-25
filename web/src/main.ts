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
