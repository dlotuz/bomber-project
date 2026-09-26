import { App } from './app/app';
import { browserStorage, defaultSettings, loadSettings, saveSettings } from './app/settings';
import { startLoop } from './app/loop';
import { parseConfig } from './game/config';
import { createMatchSession } from './game/match-session';
import type { Session } from './game/session';
import { InputManager, buildInput, emptyDevices, withEscapeAsBack } from './input/input';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { titleScreen } from './screens/title';
import { battleScreen } from './screens/battle';
import { startRomUi } from './rom/ui';

const store = browserStorage();
const search = window.location.search;
const params = new URLSearchParams(search);
// ?reset: descarta as configurações salvas (recuperação de um estado ruim, ex.: teclas remapeadas
// para algo inutilizável) e já grava o padrão de volta.
const settings = params.has('reset') ? defaultSettings() : loadSettings(store);
if (params.has('reset')) saveSettings(store, settings);
const input = new InputManager(window, settings.keymaps);
const app = new App(settings, {
  save: s => saveSettings(store, s),
  setKeymaps: maps => input.setKeymaps(maps),
  seed: () => Date.now() >>> 0,
});
// Painel da ROM (plano 5): usa a ROM guardada ou, sem ela, pede o arquivo (não abre sozinho em ?debug/?quick).
void startRomUi(document, { autoShow: !params.has('debug') && !params.has('quick') });
const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();

// ?quick abre direto numa partida com as regras da URL (ver parseConfig); sem ele, começa no título.
app.go(params.has('quick') ? battleScreen(app, createMatchSession(parseConfig(search))) : titleScreen(app));

// Gancho para as screenshots automáticas (web/scripts/snapshots.mjs); só existe em dev com ?debug.
if (import.meta.env.DEV && params.has('debug')) {
  (window as unknown as { __crown: unknown }).__crown = {
    app,
    get session(): Session | null { return (app.screen as Partial<{ session: Session }>).session ?? null; },
  };
}

let prev = emptyDevices();
startLoop(() => {
  const cur = input.poll();
  app.update(withEscapeAsBack(buildInput(cur, prev, app.settings.devices, input.takeLastKey())));
  prev = cur;
}, () => app.draw(ctx, bank));
