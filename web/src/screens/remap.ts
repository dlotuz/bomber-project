import type { App, Screen } from '../app/app';
import { Menu, type MenuRow } from './menu';
import { KEY_FIELDS, keyLabel, padLabel, type DeviceId, type KeyMap, type PadMap } from '../input/input';
import { S } from '../render/text/strings';
import { FADE_MENU } from '../app/fade';
import { drawOptionsPage, PpuCanvas, type OptionsRow } from '../render/screens-rom/options';
import { optionsScreen } from './options';

/**
 * Remapeamento de um dispositivo (teclado ou gamepad): A na ação captura, depois a tecla/botão nova grava.
 * Teclado: `inp.key` (Escape cancela). Gamepad: `inp.padButton` do próprio controle (Escape ainda cancela).
 * Depois de gravar ou cancelar: `applyInput()`, `save()` e ignora tudo até soltar (evita reabrir com a
 * tecla/botão novo ainda segurado).
 */
export function remapScreen(app: App, dev: Exclude<DeviceId, 'none'>): Screen & { readonly menu: Menu; readonly capturing: string | null } {
  const isKb = dev.startsWith('kb');
  const idx = Number(dev[2]);
  const km: KeyMap | null = isKb ? app.settings.keymaps[idx] : null;
  const pm: PadMap | null = isKb ? null : app.settings.padmaps[idx];
  let capturing: keyof KeyMap | null = null;
  let suppress = false;

  const goBack = (): void => { app.transition(() => optionsScreen(app), FADE_MENU); };

  const rows: MenuRow[] = KEY_FIELDS.map(f => ({ id: f, select: () => { capturing = f; } }));
  rows.push({ id: 'back', select: () => { goBack(); } });
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();

  const title = isKb ? S.options.keys(idx + 1) : S.options.pad(idx + 1);
  const rowLabel = (f: keyof KeyMap): string => S.options.actions[f];
  const rowValue = (f: keyof KeyMap): string => (capturing === f ? '' : km ? keyLabel(km[f]) : padLabel(pm![f]));

  const finish = (): void => { capturing = null; suppress = true; app.applyInput(); app.save(); };

  return {
    id: 'remap',
    menu,
    get capturing() { return capturing; },
    update(inp) {
      if (suppress) { if (inp.any === 0) suppress = false; return; }
      if (capturing) {
        const f = capturing;
        if (inp.key === 'Escape') { finish(); return; }
        if (km && inp.key) { km[f] = inp.key; finish(); return; }
        if (pm && inp.padButton && inp.padButton.pad === idx) { pm[f] = inp.padButton.button; finish(); }
        return;
      }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      const rowsOut: OptionsRow[] = [
        ...KEY_FIELDS.map(f => ({ label: rowLabel(f), value: rowValue(f) })),
        { label: S.options.back, value: '' },
      ];
      const footer = capturing ? (isKb ? S.options.pressKey : S.options.pressPad) : undefined;
      drawOptionsPage(ctx, bank, canvas, title, rowsOut, menu.cursor, footer, 'ascii8');
    },
  };
}
