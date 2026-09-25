import type { App, Screen } from '../app/app';
import { drawTextCentered, SCREEN_W } from '../render/draw-game';
import { MenuList } from './menu';
import { COLORS, drawBackground, drawFooter, drawMenu, drawPanel } from './ui';
import { vsModeScreen } from './vs';
import { settingsScreen } from './settings-screen';

export function titleScreen(app: App): Screen {
  const list = new MenuList([
    { label: 'JOGO NORMAL', value: () => 'EM BREVE', disabled: true },
    { label: 'JOGO DE BATALHA', select: () => app.go(vsModeScreen(app)) },
    { label: 'CONFIGURAÇÕES', select: () => app.go(settingsScreen(app)) },
  ]);
  return {
    id: 'title',
    update(inp) { list.handle(inp.pressedAny); },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 22, 36, 24);
      drawTextCentered(ctx, bank, 'CROWN BLAST', COLORS.title, 54, 3);
      drawPanel(ctx, 40, 116, 176, 62);
      drawMenu(ctx, bank, list, 56, 124, 148, frame);
      drawFooter(ctx, bank, 'ENTER / START PARA ESCOLHER');
    },
  };
}
