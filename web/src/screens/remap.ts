import type { App, Screen } from '../app/app';
import { Menu, cycle, type MenuRow } from './menu';
import {
  KEY_FIELDS, DEFAULT_KEYMAPS, DEFAULT_PADMAP, DEVICE_IDS, keyLabel, padLabel, assignKey, assignPadButton, isReservedKey,
  type DeviceId, type KeyMap,
} from '../input/input';
import { defaultSettings, setDevice } from '../app/settings';
import { S } from '../render/text/strings';
import { FADE_MENU } from '../app/fade';
import { drawOptionsPage, PpuCanvas, type OptionsRow } from '../render/screens-rom/options';
import { optionsScreen } from './options';

type Capture = keyof KeyMap | 'device';

/**
 * Controles de um jogador: dispositivo (←/→ troca; A espera uma tecla ou um botão e escolhe o teclado ou aquele
 * controle), as 12 ações dele (A na ação, depois a tecla/botão nova), "configurar todos" (pede uma ação depois da
 * outra), restaurar o padrão deste jogador e voltar. Na captura vale tecla (`inp.key`; Escape cancela; F1–F12, Tab e
 * as teclas do sistema são ignoradas) ou botão de qualquer controle (`inp.padButton`), e o jogador passa para o
 * dispositivo usado. Tecla/botão já usado em outra ação: as duas
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
        setDevice(st.devices, player, defaultSettings().devices[player]);
        app.applyInput(); app.save();
      },
    },
    { id: 'back', select: () => { goBack(); } },
  ];
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();

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
      if (suppress) { if (inp.any === 0) suppress = false; return; }
      if (capturing) {
        if (inp.key === 'Escape') { cancel(); return; }
        // Aceita qualquer dispositivo (senão quem está no controle ficaria preso esperando uma tecla): o jogador passa a
        // usar aquele em que apertou.
        const key = inp.key && !isReservedKey(inp.key) ? inp.key : null;
        const pb = inp.padButton && inp.padButton.pad < 4 ? inp.padButton : null;
        if (!key && !pb) return;
        setDevice(st.devices, player, key ? 'kb' : `gp${pb!.pad}` as DeviceId);
        if (capturing !== 'device') {
          if (key) assignKey(st.keymaps, player, capturing, key);
          else assignPadButton(st.padmaps[player], capturing, pb!.button);
        }
        done();
        return;
      }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      const rowsOut: OptionsRow[] = rows.map(r => ({ label: label(r.id), value: value(r.id) }));
      const footer = capturing ? S.options.pressAny : undefined;
      drawOptionsPage(ctx, bank, canvas, S.options.controls(player + 1), rowsOut, menu.cursor, footer, 'ascii8');
    },
  };
}
