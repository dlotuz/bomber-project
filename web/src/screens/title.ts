import type { App, Screen } from '../app/app';
import type { MenuInput } from '../input/input';
import { BTN } from '../game/core-api';
import { Menu, type MenuRow } from './menu';
import { drawStaticCursor } from './ui';
import { pressStartVisible } from '../game/timeline';
import { FADE_FROM_TITLE } from '../app/fade';
import { MUSIC } from '../app/audio';
import titleUrl from '../assets/title.png';
import { playersScreen } from './players';

/** Arte do título (256×192, com o menu já desenhado), centrada na vertical sobre o preto da própria arte. */
const ART_Y = 16;
/** Cursor à esquerda de "BATTLE GAME", a única linha do menu da arte (medido na arte reduzida). */
const CURSOR = [73, 151] as const;
let art: HTMLImageElement | null = null;
const artImg = (): HTMLImageElement | null => {
  if (!art && typeof Image !== 'undefined') { art = new Image(); art.src = titleUrl; }
  return art?.complete ? art : null;
};

export type TitleScreen = Screen & { readonly cursor: number; pressStartVisible(): boolean };

/** Tela de título [spec §6.2, R22]: arte própria só com "BATTLE GAME" e cursor parado. B e o resto não fazem nada (B não é passado à `Menu`,
 *  que devolveria 'back' com SFX — o título não tem "voltar"). */
export function titleScreen(app: App): TitleScreen {
  app.audio.ensureMenus(MUSIC.title);
  const rows: MenuRow[] = [
    // Sempre "Todos contra Todos": a escolha de modo não é mostrada.
    { id: 'battle', select: () => { app.settings.setup.mode = 'ffa'; app.save(); app.transition(() => playersScreen(app), FADE_FROM_TITLE); } },
  ];
  const menu = new Menu(rows);
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
    draw(ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 224);
      const img = artImg();
      if (img) ctx.drawImage(img, 0, ART_Y);
      drawStaticCursor(ctx, CURSOR[0], CURSOR[1], '#ffffff');
    },
  };
}
