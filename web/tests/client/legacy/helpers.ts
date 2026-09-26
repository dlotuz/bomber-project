// Ajudantes dos testes antigos de telas (saídos de tests/client/screens.test.ts). Apagado pela T22.
import { App } from '../../../src/app/app';
import { defaultSettings, type Settings } from '../../../src/app/settings';
import { idleInput } from '../../../src/input/input';

export function mkApp(settings: Settings = defaultSettings()) {
  let saves = 0;
  const keymaps: unknown[] = [];
  const app = new App(settings, { save: () => { saves++; }, setKeymaps: m => { keymaps.push(m); }, seed: () => 1 });
  return { app, saves: () => saves, keymaps };
}

/** Aperta e solta um botão: em qualquer dispositivo (menus) e, se `slot` for dado, no dispositivo daquele jogador. */
export function press(app: App, btn: number, slot?: number) {
  const i = idleInput();
  i.any = i.pressedAny = btn;
  if (slot !== undefined) { i.pads[slot] = btn; i.pressed[slot] = btn; }
  app.update(i);
  app.update(idleInput());
}
export const idle = (app: App, n: number) => { for (let k = 0; k < n; k++) app.update(idleInput()); };
