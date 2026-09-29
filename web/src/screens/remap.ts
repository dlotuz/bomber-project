import type { App, Screen } from '../app/app';
import { Menu, cycle, type MenuRow } from './menu';
import {
  KEY_FIELDS, DEFAULT_KEYMAPS, DEFAULT_PADMAP, DEVICE_IDS, keyLabel, padLabel, assignKey, assignPadButton, isReservedKey,
  type DeviceId, type KeyMap,
} from '../input/input';
import { setDevice } from '../app/settings';
import { S } from '../render/text/strings';
import { FADE_MENU } from '../app/fade';
import { drawOptionsPage, PpuCanvas, type OptionsRow } from '../render/screens-rom/options';
import { optionsScreen } from './options';

type Capture = keyof KeyMap | 'device';

/**
 * Controles de um jogador: dispositivo (←/→ troca; A espera uma tecla ou um botão e escolhe o teclado ou aquele
 * controle), as 12 ações dele (A na ação, depois a tecla/botão nova), "configurar todos" (pede uma ação depois da
 * outra), restaurar o padrão deste jogador e voltar. Teclado: `inp.key` (Escape cancela; F1–F12, Tab e as teclas do
 * sistema são ignoradas). Controle: `inp.padButton` do próprio controle. Tecla/botão já usado em outra ação: as duas
 * trocam (`assignKey`/`assignPadButton`). Depois de gravar ou cancelar: `applyInput()`, `save()` e ignora tudo até
 * soltar (evita reabrir com a tecla/botão novo ainda segurado).
 */
export function remapScreen(app: App, player: number): Screen & { readonly menu: Menu; readonly capturing: Capture | null } {
  const st = app.settings;
  const dev = (): DeviceId => st.devices[player];
  let capturing: Capture | null = null;
  let seq = false;
  let suppress = false;

  const goBack = (): void => { app.transition(() => optionsScreen(app, player), FADE_MENU); };
  const capture = (c: Capture): void => { capturing = c; menu.cursor = rows.findIndex(r => r.id === c); };
  const turn = (d: number): boolean => { setDevice(st.devices, player, cycle(DEVICE_IDS, dev(), d)); app.save(); return true; };

  const rows: MenuRow[] = [
    { id: 'device', left: () => turn(-1), right: () => turn(1), select: () => { capture('device'); } },
    ...KEY_FIELDS.map(f => ({ id: f, select: () => { capture(f); } })),
    { id: 'all', select: () => { seq = true; capture(KEY_FIELDS[0]); } },
    {
      id: 'reset', select: () => {
        for (const f of KEY_FIELDS) assignKey(st.keymaps, player, f, DEFAULT_KEYMAPS[player][f]);
        st.padmaps[player] = { ...DEFAULT_PADMAP };
        app.applyInput(); app.save();
      },
    },
    { id: 'back', select: () => { goBack(); } },
  ];
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();
  // Sem dispositivo não há o que mapear: as ações ficam cinza e o cursor pula.
  const syncDisabled = (): void => { for (const r of rows) if (r.id !== 'device' && r.id !== 'back') r.disabled = dev() === 'none'; };

  const label = (id: string): string => (id === 'device' ? S.options.device : id === 'all' ? S.options.all
    : id === 'reset' ? S.options.reset : id === 'back' ? S.options.back : S.options.actions[id as keyof KeyMap]);
  const value = (id: string): string => {
    if (id === capturing) return '';
    if (id === 'device') return S.options.devices[dev()];
    if (!(KEY_FIELDS as readonly string[]).includes(id) || dev() === 'none') return '';
    const f = id as keyof KeyMap;
    return dev() === 'kb' ? keyLabel(st.keymaps[player][f]) : padLabel(st.padmaps[player][f]);
  };

  const done = (): void => {
    const i = seq && capturing && capturing !== 'device' ? KEY_FIELDS.indexOf(capturing) + 1 : KEY_FIELDS.length;
    if (i < KEY_FIELDS.length) capture(KEY_FIELDS[i]);
    else { capturing = null; seq = false; }
    suppress = true; app.applyInput(); app.save();
  };
  const cancel = (): void => { seq = false; capturing = null; suppress = true; app.applyInput(); app.save(); };

  return {
    id: 'remap',
    menu,
    get capturing() { return capturing; },
    update(inp) {
      syncDisabled();
      if (suppress) { if (inp.any === 0) suppress = false; return; }
      if (capturing) {
        if (inp.key === 'Escape') { cancel(); return; }
        const d = dev();
        if (capturing === 'device') {
          if (inp.key && !isReservedKey(inp.key)) { setDevice(st.devices, player, 'kb'); done(); }
          else if (inp.padButton && inp.padButton.pad < 4) { setDevice(st.devices, player, `gp${inp.padButton.pad}` as DeviceId); done(); }
          return;
        }
        const f = capturing;
        if (d === 'kb' && inp.key) { if (!isReservedKey(inp.key)) { assignKey(st.keymaps, player, f, inp.key); done(); } return; }
        if (d !== 'kb' && inp.padButton && `gp${inp.padButton.pad}` === d) { assignPadButton(st.padmaps[player], f, inp.padButton.button); done(); }
        return;
      }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      syncDisabled();
      const rowsOut: OptionsRow[] = rows.map(r => ({ label: label(r.id), value: value(r.id), disabled: r.disabled }));
      const footer = capturing === 'device' ? S.options.pressAny
        : capturing ? (dev() === 'kb' ? S.options.pressKey : S.options.pressPad) : undefined;
      drawOptionsPage(ctx, bank, canvas, S.options.controls(player + 1), rowsOut, menu.cursor, footer, 'ascii8');
    },
  };
}
