import type { App, Screen } from '../app/app';
import type { MenuInput } from '../input/input';
import { Menu, type MenuRow } from './menu';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import { hdMenu } from '../render/hd-menu';
import { titleScreen } from './title';
import { playersScreen } from './players';

const MODE_X = 85, MODE_Y = [95, 127] as const, MODE_HAND_X = 61, MODE_HAND_Y = [96, 128] as const;
/** Âncora (centro, topo) do título, presa à faixa de texto da captura em `tests/screens/menu-title.test.ts`. */
export const MODE_TITLE = { x: 127, y: 63 } as const;

/** "Escolha o modo VS!" [spec §6.3, R31], logo depois do título (a escolha Battle Royale / Campeonato / Bombermania
 *  saiu: só a 1ª existia): Todos contra Todos / Em Equipes. Cursor inicial = `setup.mode`. A grava e vai a
 *  `playersScreen`; B volta ao título. */
export function modeScreen(app: App): Screen & { readonly cursor: number } {
  app.audio.ensureMenus(MUSIC.menus);
  const setup = app.settings.setup;
  const pick = (mode: 'ffa' | 'team') => (): void => {
    setup.mode = mode;
    app.save();
    app.transition(() => playersScreen(app), FADE_MENU);
  };
  const rows: MenuRow[] = [
    { id: 'ffa', select: pick('ffa') },
    { id: 'team', select: pick('team') },
  ];
  const menu = new Menu(rows, { cursor: setup.mode === 'team' ? 1 : 0 });
  const items = [S.vs.ffa, S.vs.team] as const;

  return {
    id: 'mode',
    get cursor() { return menu.cursor; },
    update(inp: MenuInput) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') app.transition(() => titleScreen(app), FADE_TO_TITLE);
    },
    draw(ctx, bank) {
      hdMenu(ctx, [MODE_HAND_X, MODE_HAND_Y[menu.cursor]]);
      drawText(ctx, bank, 'menuTitle', S.vs.title, MODE_TITLE.x, MODE_TITLE.y, { align: 'center' });
      items.forEach((t, i) => drawText(ctx, bank, 'menuItem', t, MODE_X, MODE_Y[i]));
    },
  };
}
