import type { App, Screen } from '../app/app';
import { drawTextCentered, SCREEN_W } from '../render/draw-game';
import { MenuList } from './menu';
import { COLORS, drawBackground, drawFooter, drawMenu, drawPanel } from './ui';
import { vsModeScreen } from './vs';
import { optionsScreen } from './options';

// Nota (T15): assinatura provisória. A T8 (não mesclada nesta worktree) troca este arquivo por inteiro
// (3 itens — Jogo Normal/Jogo de Batalha/Opções —, cena da ROM, mão parada e "APERTE START!", conforme o
// brief dela). Aqui só o mínimo para não travar a T15, que já depende do 2º parâmetro (`cursor`) e de abrir
// `optionsScreen` (a T8 já assume essa troca no próprio brief): confira de novo depois do merge da T8.
export function titleScreen(app: App, o: { cursor?: number } = {}): Screen & { readonly cursor: number } {
  const list = new MenuList([
    { label: 'BATALHA', select: () => app.go(vsModeScreen(app)) },
    { label: 'CONFIGURAÇÕES', select: () => app.go(optionsScreen(app)) },
  ]);
  if (o.cursor !== undefined) list.cursor = o.cursor;
  return {
    id: 'title',
    get cursor() { return list.cursor; },
    update(inp) { list.handle(inp.pressedAny); },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      ctx.drawImage(bank.crown(), (SCREEN_W - 36) / 2, 22, 36, 24);
      drawTextCentered(ctx, bank, 'CROWN BLAST', COLORS.title, 54, 3);
      drawPanel(ctx, 40, 120, 176, 46);
      drawMenu(ctx, bank, list, 56, 128, 148, frame);
      drawFooter(ctx, bank, 'ENTER / START PARA ESCOLHER');
    },
  };
}
