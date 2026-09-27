import type { App, Screen } from '../app/app';
import type { MenuInput } from '../input/input';
import { BTN } from '../game/core-api';
import { Menu, type MenuRow } from './menu';
import { drawStaticBackground, drawStaticCursor } from './ui';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { drawTextCentered, SCREEN_W } from '../render/draw-game';
import { TITLE, pressStartVisible } from '../game/timeline';
import { FADE_FROM_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import { romState } from '../app/rom-api';
import { PpuCanvas } from '../render/screens-rom/scene';
import { titleFrame } from '../render/screens-rom/title';
import { vsModeScreen } from './vs';
import { optionsScreen } from './options';

const TEXT_X = 72;
/** Medido na captura (`g_title2vs`, `TITLE_TEXT_RECTS[1]` y 126–152): "PUSH START BUTTON!" fica logo acima do menu,
 *  não embaixo (o y = 200 do plano cobria a linha "©1996 HUDSON SOFT"). */
const PRESS_START = { x: 128, y: 131 };

export type TitleScreen = Screen & { readonly cursor: number; pressStartVisible(): boolean };

/** Tela de título [spec §6.2, R22]: "JOGO NORMAL" (desativado), "JOGO DE BATALHA" e "OPÇÕES", mão parada e
 *  logo A14 (OBJ + BG1, T19). ↑/↓ com volta pela `Menu`; B e o resto não fazem nada (B não é passado à `Menu`,
 *  que devolveria 'back' com SFX — o título não tem "voltar"). */
export function titleScreen(app: App, o: { cursor?: 0 | 1 | 2 } = {}): TitleScreen {
  app.audio.ensureMenus(MUSIC.title);
  const rows: MenuRow[] = [
    { id: 'normal', disabled: true },
    { id: 'battle', select: () => { app.transition(() => vsModeScreen(app), FADE_FROM_TITLE); } },
    { id: 'options', select: () => { app.transition(() => optionsScreen(app), FADE_FROM_TITLE); } },
  ];
  const menu = new Menu(rows, { cursor: o.cursor ?? 1 });
  const canvas = new PpuCanvas();
  const items = [S.title.normal, S.title.battle, S.title.options] as const;
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
      const a = romState.assets;
      if (a) {
        canvas.draw(ctx, titleFrame(a, TITLE.cursorX, TITLE.rowsY[menu.cursor]));
      } else {
        drawStaticBackground(ctx);
        ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 22, 36, 24);
        drawTextCentered(ctx, bank, 'CROWN BLAST', '#ffd23f', 54, 3);
        drawStaticCursor(ctx, TITLE.cursorX, TITLE.rowsY[menu.cursor]);
      }
      items.forEach((t, i) => drawText(ctx, bank, 'titleMenu', t, TEXT_X, TITLE.rowsY[i], { tone: i === 0 ? 'gray' : 'default' }));
      // M2: amarelo como "PUSH START BUTTON!" do original (família de índices 5–9 da mesma linha de paleta).
      if (visible()) drawText(ctx, bank, 'titleMenu', S.title.pressStart, PRESS_START.x, PRESS_START.y, { align: 'center', tone: 'yellow' });
    },
  };
}
