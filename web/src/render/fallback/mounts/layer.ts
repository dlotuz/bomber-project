import type { FallbackBattleLayer } from '../../battle-layers';
import { pixToCanvas, type Img } from '../../sprite-bank';
import { fallbackMountSprites } from './sprites';

const cache = new Map<string, Img>();
export const fallbackMountLayer: FallbackBattleLayer = {
  id: 'mounts',
  draw(s, ctx, _bank, frame) {
    for (const sp of fallbackMountSprites(s, frame)) {
      let img = cache.get(sp.key);
      if (!img) { img = pixToCanvas(sp.make()); cache.set(sp.key, img); }
      ctx.drawImage(img, sp.x, sp.y);
    }
  },
};
