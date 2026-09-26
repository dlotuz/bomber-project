import type { FallbackBattleLayer } from '../../battle-layers';
import { pixToCanvas, type Img } from '../../sprite-bank';
import { fallbackMountSprites, type FbSprite } from './sprites';

const cache = new Map<string, Img>();
const imgOf = (sp: FbSprite): Img => {
  let img = cache.get(sp.key);
  if (!img) { img = pixToCanvas(sp.make()); cache.set(sp.key, img); }
  return img;
};

export const fallbackMountLayer: FallbackBattleLayer = {
  id: 'mounts',
  draw(s, ctx, _bank, frame) {
    for (const sp of fallbackMountSprites(s, frame)) ctx.drawImage(imgOf(sp), sp.x, sp.y);
  },
};

/** Linha da arte 24×20 da montaria (topo em Y−12) a partir da qual ela passa por cima do cavaleiro: Y+2, logo abaixo
 *  da cintura do bomber de fallback (16×20 em Y−11) — cabeça e tronco à mostra, pernas dentro da montaria (conferido
 *  em screenshot; com 10 o cavaleiro sumia até o capacete). */
export const MOUNT_FRONT_ROW = 14;

/** Camada `over` (depois dos jogadores): redesenha só a parte da frente/de baixo da montaria de quem está montado,
 *  para ela cobrir a metade de baixo do cavaleiro. A montaria inteira continua saindo antes, em `fallbackMountLayer`. */
export const fallbackMountFrontLayer: FallbackBattleLayer = {
  id: 'mounts-front', over: true,
  draw(s, ctx, _bank, frame) {
    for (const sp of fallbackMountSprites(s, frame)) {
      if (!sp.front) continue;
      const img = imgOf(sp), h = img.height - MOUNT_FRONT_ROW;
      if (h > 0) ctx.drawImage(img, 0, MOUNT_FRONT_ROW, img.width, h, sp.x, sp.y + MOUNT_FRONT_ROW, img.width, h);
    }
  },
};
