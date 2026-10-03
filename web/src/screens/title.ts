import type { App, Screen } from '../app/app';
import type { MenuInput } from '../input/input';
import { BTN } from '../game/core-api';
import { Menu, type MenuRow } from './menu';
import { pressStartVisible } from '../game/timeline';
import { FADE_FROM_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import { drawText } from '../render/text/text';
import { hdMenu } from '../render/hd-menu';
import { playersScreen } from './players';
import { optionsScreen } from './options';
import { onlineScreen } from './online';
import { S } from '../render/text/strings';

/** Menu desenhado sobre a arte (o texto dela foi apagado), alinhado à esquerda, à direita da mão do mascote (a luva não some atrás dela). */
const TEXT_X = 94, ROWS_Y = [140, 157, 174] as const, ITEMS = ['BATTLE GAME', S.online.menu, 'OPTIONS'] as const;

export type TitleScreen = Screen & { readonly cursor: number; pressStartVisible(): boolean };

/** Tela de título [spec §6.2, R22]: arte própria com "BATTLE GAME", "SALA ONLINE" e "OPTIONS" e a luva parada. B e o resto não fazem nada (B não é passado à `Menu`,
 *  que devolveria 'back' com SFX — o título não tem "voltar"). */
export function titleScreen(app: App, o: { cursor?: 0 | 1 | 2 } = {}): TitleScreen {
  app.audio.ensureMenus(MUSIC.title);
  const rows: MenuRow[] = [
    // Sempre "Todos contra Todos": a escolha de modo não é mostrada.
    { id: 'battle', select: () => { app.settings.setup.mode = 'ffa'; app.save(); app.transition(() => playersScreen(app), FADE_FROM_TITLE); } },
    { id: 'online', select: () => { app.transition(() => onlineScreen(app), FADE_FROM_TITLE); } },
    { id: 'options', select: () => { app.transition(() => optionsScreen(app), FADE_FROM_TITLE); } },
  ];
  const menu = new Menu(rows, { cursor: o.cursor ?? 0 });
  // M12: o pisca conta a partir da entrada no título (não do `app.frame` global), aceso no 1º quadro.
  let t = 0;
  const visible = (): boolean => pressStartVisible(t);

  return {
    id: 'title',
    get cursor() { return menu.cursor; },
    pressStartVisible: visible,
    update(inp: MenuInput) {
      t++;
      menu.update(inp.any, inp.pressedAny & ~BTN.B, app.audio);
    },
    draw(ctx, bank) {
      hdMenu(ctx, [TEXT_X - 16, ROWS_Y[menu.cursor]], { hand: 1.1 }, 'title');
      ITEMS.forEach((t, i) => drawText(ctx, bank, 'titleMenu', t, TEXT_X, ROWS_Y[i]));
    },
  };
}
