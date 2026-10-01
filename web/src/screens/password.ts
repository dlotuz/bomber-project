import type { App, Screen } from '../app/app';
import { Menu, type MenuRow } from './menu';
import { S } from '../render/text/strings';
import { FADE_MENU } from '../app/fade';
import { drawOptionsPage, PpuCanvas, type OptionsRow } from '../render/screens-rom/options';
import { optionsScreen } from './options';

/** Senha da tela PASSWORD do original que liga $7F:70BD (ovos dos 13 tipos). Aqui ela liga e desliga. */
export const ALL_MOUNTS_CODE = '0164';

/** Senha (Opções → Jogabilidade): 4 dígitos (←/→ muda 0–9, com volta), CONFIRMAR e VOLTAR. `back` = linha de
 *  volta na Jogabilidade. */
export function passwordScreen(app: App, back: number): Screen & { readonly menu: Menu; readonly digits: number[]; readonly note: string } {
  const digits = [0, 0, 0, 0];
  let note = '';
  const turn = (i: number, d: number): boolean => { digits[i] = (digits[i] + d + 10) % 10; note = ''; return true; };
  const goBack = (): void => { app.transition(() => optionsScreen(app, back, 'gameplay'), FADE_MENU); };
  const rows: MenuRow[] = [
    ...digits.map((_, i) => ({ id: `d${i}`, left: () => turn(i, -1), right: () => turn(i, 1) })),
    {
      id: 'ok', select: () => {
        if (digits.join('') !== ALL_MOUNTS_CODE) { note = S.password.wrong; return false; }
        const o = app.settings.options;
        o.allMounts = !o.allMounts; app.save();
        note = o.allMounts ? S.password.on : S.password.off;
      },
    },
    { id: 'back', select: () => { goBack(); } },
  ];
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();
  const label = (id: string, i: number): string => (id === 'ok' ? S.password.ok : id === 'back' ? S.options.back : S.password.digit(i + 1));

  return {
    id: 'password',
    menu,
    digits,
    get note() { return note; },
    update(inp) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') goBack();
    },
    draw(ctx, bank) {
      const out: OptionsRow[] = rows.map((r, i) => ({ label: label(r.id, i), value: i < 4 ? String(digits[i]) : '' }));
      drawOptionsPage(ctx, bank, canvas, S.password.title, out, menu.cursor, note || S.password.help);
    },
  };
}
