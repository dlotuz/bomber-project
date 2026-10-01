import type { App, Screen } from '../app/app';
import type { SlotKind } from '../app/settings';
import { canStart } from '../game/config';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import { S } from '../render/text/strings';
import { drawText } from '../render/text/text';
import type { Tone } from '../render/text/types';
import { hdMenu } from '../render/hd-menu';
import { Menu, type MenuRow } from './menu';
import { titleScreen } from './title';
import { rulesScreen } from './rules';

/** Ordem do cursor de valor [A15]: ← avança (Humano→CPU→Nenhum), → recua; os dois param no limite. */
/** Âncora (centro, topo) do título, presa à faixa de texto da captura em `tests/screens/menu-title.test.ts`. */
export const PLAYERS_TITLE = { x: 127, y: 13 } as const;
const KINDS: readonly SlotKind[] = ['human', 'cpu', 'off'];
const LABEL: Record<SlotKind, string> = { human: S.players.human, cpu: S.players.cpu, off: S.players.off };
const TONE: Record<SlotKind, Tone> = { human: 'green', cpu: 'red', off: 'blue' };

/** "Defina os jogadores": Humano / CPU / Nenhum por linha, sem time (a T10 cuida disso em `teamsScreen`). */
export function playersScreen(app: App): Screen & { readonly cursor: number; value(i: number): { text: string; tone: Tone } } {
  const setup = app.settings.setup;
  app.audio.ensureMenus(MUSIC.menus);

  const value = (i: number): { text: string; tone: Tone } => {
    const k = setup.slots[i];
    return { text: LABEL[k], tone: TONE[k] };
  };
  const shift = (i: number, d: 1 | -1): boolean => {
    const idx = KINDS.indexOf(setup.slots[i]);
    const next = idx + d;
    if (next < 0 || next >= KINDS.length) return false;
    setup.slots[i] = KINDS[next];
    app.save();
    return true;
  };
  const rows: MenuRow[] = [0, 1, 2, 3, 4].map(i => ({
    id: `p${i}`,
    left: () => shift(i, 1),
    right: () => shift(i, -1),
    select: () => {
      if (!canStart(setup.slots)) return false;
      app.transition(() => rulesScreen(app), FADE_MENU);
      return true;
    },
  }));
  const menu = new Menu(rows);

  return {
    id: 'players',
    get cursor() { return menu.cursor; },
    value,
    update(inp) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') app.transition(() => titleScreen(app), FADE_TO_TITLE);
    },
    draw(ctx, bank) {
      hdMenu(ctx, [24, 48 + 32 * menu.cursor]);
      drawText(ctx, bank, 'menuTitle', S.players.title, PLAYERS_TITLE.x, PLAYERS_TITLE.y, { align: 'center' });
      for (let i = 0; i < 5; i++) {
        const y = 47 + 32 * i;
        drawText(ctx, bank, 'menuItem', S.players.row[i], 48, y);
        const v = value(i);
        drawText(ctx, bank, 'menuItem', v.text, 160, y, { tone: v.tone });
      }
    },
  };
}
