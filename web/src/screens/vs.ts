import type { App, Screen } from '../app/app';
import type { MenuInput } from '../input/input';
import { Menu, type MenuRow } from './menu';
import { drawStaticBackground, drawStaticCursor, drawFallbackFrame } from './ui';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import { romState } from '../app/rom-api';
import { PpuCanvas, sceneGfx, sceneFrame, handCursor } from '../render/screens-rom/scene';
import { VS_FRAME, MODE_FRAME, vsSceneMaps, modeSceneMaps } from '../render/screens-rom/vs';
import { titleScreen } from './title';
import { playersScreen } from './players';

const VS_X = 80, VS_Y = [79, 111, 143] as const, VS_HAND_X = 56, VS_HAND_Y = [80, 112, 144] as const;
const MODE_X = 85, MODE_Y = [95, 127] as const, MODE_HAND_X = 61, MODE_HAND_Y = [96, 128] as const;
const TITLE_X = 127, TITLE_Y = 47;

/** "Escolha o modo VS!" [spec §6.3, R31]: só "Battle Royale" está ativo. A → `modeScreen`; B volta ao título. */
export function vsModeScreen(app: App): Screen & { readonly cursor: number } {
  app.audio.ensureMenus(MUSIC.menus);
  const rows: MenuRow[] = [
    { id: 'royale', select: () => { app.transition(() => modeScreen(app), FADE_MENU); } },
    { id: 'champ', disabled: true },
    { id: 'mania', disabled: true },
  ];
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();
  const items = [S.vs.royale, S.vs.champ, S.vs.mania] as const;

  return {
    id: 'vs',
    get cursor() { return menu.cursor; },
    update(inp: MenuInput) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') {
        app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE);
      }
    },
    draw(ctx, bank) {
      const a = romState.assets;
      if (a) {
        const g = sceneGfx(a, 'vsmode');
        canvas.draw(ctx, sceneFrame(g, vsSceneMaps(), { oam: [handCursor(VS_HAND_X, VS_HAND_Y[menu.cursor])] }));
      } else {
        drawStaticBackground(ctx);
        drawFallbackFrame(ctx, VS_FRAME);
        drawStaticCursor(ctx, VS_HAND_X, VS_HAND_Y[menu.cursor]);
      }
      drawText(ctx, bank, 'menuTitle', S.vs.title, TITLE_X, TITLE_Y, { align: 'center' });
      items.forEach((t, i) => drawText(ctx, bank, 'menuItem', t, VS_X, VS_Y[i], { tone: i === 0 ? 'default' : 'gray' }));
    },
  };
}

/** "Battle Royale" [spec §6.3, R31]: Todos contra Todos / Em Equipes. Cursor inicial = `setup.mode`. A grava e
 *  vai a `playersScreen`; B volta ao VS. */
export function modeScreen(app: App): Screen & { readonly cursor: number } {
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
  const canvas = new PpuCanvas();
  const items = [S.vs.ffa, S.vs.team] as const;

  return {
    id: 'mode',
    get cursor() { return menu.cursor; },
    update(inp: MenuInput) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') app.transition(() => vsModeScreen(app), FADE_MENU);
    },
    draw(ctx, bank) {
      const a = romState.assets;
      if (a) {
        const g = sceneGfx(a, 'ffa');
        canvas.draw(ctx, sceneFrame(g, modeSceneMaps(), { oam: [handCursor(MODE_HAND_X, MODE_HAND_Y[menu.cursor])] }));
      } else {
        drawStaticBackground(ctx);
        drawFallbackFrame(ctx, MODE_FRAME);
        drawStaticCursor(ctx, MODE_HAND_X, MODE_HAND_Y[menu.cursor]);
      }
      drawText(ctx, bank, 'menuTitle', S.vs.title, TITLE_X, TITLE_Y, { align: 'center' });
      items.forEach((t, i) => drawText(ctx, bank, 'menuItem', t, MODE_X, MODE_Y[i]));
    },
  };
}
